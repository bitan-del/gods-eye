/**
 * GLM CN (chatglm.cn / 智谱清言) browser client.
 *
 * Runtime strategy: embedded persistent Playwright page.
 *
 * chatglm.cn rejects direct node `fetch()` requests (TLS fingerprinting
 * + WAF + signed-request headers). The upstream reference implementation
 * solves this by running the real POST from inside a browser page via
 * `page.evaluate`, so we mirror that approach: connect to the logged-in
 * Chrome profile via CDP, land on https://chatglm.cn/ once, and drive the
 * real streaming endpoint
 *
 *   POST https://chatglm.cn/chatglm/backend-api/assistant/stream
 *
 * via `page.evaluate` with the `Authorization: Bearer <chatglm_token>`
 * header and the X-Sign/X-Nonce/X-Timestamp headers derived from the
 * upstream client. We fall through to a cookie-only flow if the token is
 * not yet available; the `refreshAccessToken()` path hits
 * `/chatglm/user-api/user/refresh` inside the page to rotate the access
 * token from the stored refresh cookie.
 *
 * The full SSE body is buffered in the page and returned as a single
 * ReadableStream chunk, which `glm-cn-stream.ts` then splits back into
 * `data:` lines. (We buffer rather than stream-pull because the caller
 * reads synchronously before `pull()` would ever be invoked.)
 */

import crypto from "node:crypto";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import {
  launchChromeForLogin,
  stopChrome,
  type RunningChrome,
} from "../../browser/chrome-launcher.js";

const SIGN_SECRET = "8a1317a7468aa3ad86e997d08f3f31cb";

const X_EXP_GROUPS =
  "na_android_config:exp:NA,na_4o_config:exp:4o_A,tts_config:exp:tts_config_a," +
  "na_glm4plus_config:exp:open,mainchat_server_app:exp:A,mobile_history_daycheck:exp:a," +
  "desktop_toolbar:exp:A,chat_drawing_server:exp:A,drawing_server_cogview:exp:cogview4," +
  "app_welcome_v2:exp:A,chat_drawing_streamv2:exp:A,mainchat_rm_fc:exp:add," +
  "mainchat_dr:exp:open,chat_auto_entrance:exp:A,drawing_server_hi_dream:control:A," +
  "homepage_square:exp:close,assistant_recommend_prompt:exp:3,app_home_regular_user:exp:A," +
  "memory_common:exp:enable,mainchat_moe:exp:300,assistant_greet_user:exp:greet_user," +
  "app_welcome_personalize:exp:A,assistant_model_exp_group:exp:glm4.5," +
  "ai_wallet:exp:ai_wallet_enable";

const ASSISTANT_ID_MAP: Record<string, string> = {
  "glm-4-plus": "65940acff94777010aa6b796",
  "glm-4": "65940acff94777010aa6b796",
  "glm-4-think": "676411c38945bbc58a905d31",
  "glm-4-zero": "676411c38945bbc58a905d31",
};
const DEFAULT_ASSISTANT_ID = "65940acff94777010aa6b796";

function generateSign(): { timestamp: string; nonce: string; sign: string } {
  const e = Date.now();
  const A = e.toString();
  const t = A.length;
  const o = A.split("").map((c) => Number(c));
  const i = o.reduce((acc, v) => acc + v, 0) - (o[t - 2] ?? 0);
  const a = i % 10;
  const timestamp = A.substring(0, t - 2) + a + A.substring(t - 1, t);
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const sign = crypto
    .createHash("md5")
    .update(`${timestamp}-${nonce}-${SIGN_SECRET}`)
    .digest("hex");
  return { timestamp, nonce, sign };
}

export interface GlmCnWebClientOptions {
  cookie: string;
  bearer?: string;
  userAgent?: string;
}

export class GlmCnWebClient {
  private cookie: string;
  private accessToken: string | undefined;
  private userAgent: string;
  private deviceId = crypto.randomUUID().replace(/-/g, "");
  private running: RunningChrome | null = null;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private initialized = false;

  constructor(options: GlmCnWebClientOptions | string) {
    let opts: GlmCnWebClientOptions;
    if (typeof options === "string") {
      try {
        const parsed = JSON.parse(options) as GlmCnWebClientOptions | string;
        opts = typeof parsed === "string" ? { cookie: parsed } : parsed;
      } catch {
        opts = { cookie: options };
      }
    } else {
      opts = options;
    }
    this.cookie = opts.cookie || "";
    this.accessToken = opts.bearer;
    this.userAgent =
      opts.userAgent ||
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
  }

  private parsedCookies(): Array<{ name: string; value: string; domain: string; path: string }> {
    return this.cookie
      .split(";")
      .map((c) => c.trim())
      .filter((c) => c.includes("="))
      .map((c) => {
        const [name, ...rest] = c.split("=");
        return {
          name: (name ?? "").trim(),
          value: rest.join("=").trim(),
          domain: ".chatglm.cn",
          path: "/",
        };
      })
      .filter((c) => c.name.length > 0);
  }

  private cookieValue(name: string): string | undefined {
    const c = this.parsedCookies().find((x) => x.name === name);
    return c?.value;
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    this.running = await launchChromeForLogin({
      providerId: "glm-cn-web",
      startUrl: "https://chatglm.cn/",
    });
    this.browser = await chromium.connectOverCDP(this.running.wsUrl);
    this.context = this.browser.contexts()[0] ?? (await this.browser.newContext());

    const cookies = this.parsedCookies();
    if (cookies.length > 0) {
      try {
        await this.context.addCookies(cookies);
      } catch {
        /* best effort */
      }
    }

    const existing = this.context.pages().find((p) => p.url().includes("chatglm.cn"));
    if (existing) {
      this.page = existing;
    } else {
      this.page = await this.context.newPage();
      try {
        await this.page.goto("https://chatglm.cn/", {
          waitUntil: "domcontentloaded",
          timeout: 120_000,
        });
      } catch {
        /* ignore */
      }
    }

    // Seed access token from cookie jar if not already provided via bearer.
    if (!this.accessToken) {
      this.accessToken = this.cookieValue("chatglm_token");
    }
    if (!this.accessToken) {
      await this.refreshAccessToken().catch(() => undefined);
    }
    this.initialized = true;
  }

  async refreshAccessToken(): Promise<void> {
    const refreshToken = this.cookieValue("chatglm_refresh_token");
    if (!refreshToken || !this.page) return;

    const sign = generateSign();
    const requestId = crypto.randomUUID().replace(/-/g, "");
    const result = await this.page.evaluate(
      async ({ refreshToken, deviceId, requestId, sign }) => {
        try {
          const res = await fetch("https://chatglm.cn/chatglm/user-api/user/refresh", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${refreshToken}`,
              "App-Name": "chatglm",
              "X-App-Platform": "pc",
              "X-App-Version": "0.0.1",
              "X-Device-Id": deviceId,
              "X-Request-Id": requestId,
              "X-Sign": sign.sign,
              "X-Nonce": sign.nonce,
              "X-Timestamp": sign.timestamp,
            },
            credentials: "include",
            body: JSON.stringify({}),
          });
          if (!res.ok) {
            return { ok: false as const, status: res.status, error: await res.text() };
          }
          const data = (await res.json()) as {
            result?: { access_token?: string; accessToken?: string };
            accessToken?: string;
          };
          const accessToken =
            data?.result?.access_token ?? data?.result?.accessToken ?? data?.accessToken;
          if (!accessToken) {
            return { ok: false as const, status: 200, error: "No accessToken in response" };
          }
          return { ok: true as const, accessToken };
        } catch (err) {
          return { ok: false as const, status: 500, error: String(err) };
        }
      },
      { refreshToken, deviceId: this.deviceId, requestId, sign },
    );

    if (result.ok && result.accessToken) {
      this.accessToken = result.accessToken;
    }
  }

  async chatCompletions(params: {
    message: string;
    model: string;
    conversationId?: string;
    signal?: AbortSignal;
  }): Promise<ReadableStream<Uint8Array>> {
    if (!this.page) throw new Error("GlmCnWebClient not initialized");
    if (!this.accessToken) await this.refreshAccessToken();

    const assistantId = ASSISTANT_ID_MAP[params.model] ?? DEFAULT_ASSISTANT_ID;
    const sign = generateSign();
    const requestId = crypto.randomUUID().replace(/-/g, "");

    const body = {
      assistant_id: assistantId,
      conversation_id: params.conversationId || "",
      project_id: "",
      chat_type: "user_chat",
      meta_data: {
        cogview: { rm_label_watermark: false },
        is_test: false,
        input_question_type: "xxxx",
        channel: "",
        draft_id: "",
        chat_mode: "zero",
        is_networking: false,
        quote_log_id: "",
        platform: "pc",
      },
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: params.message }],
        },
      ],
    };

    const fetchTimeoutMs = 120_000;

    const evalPromise = this.page.evaluate(
      async ({ accessToken, bodyStr, deviceId, requestId, timeoutMs, sign, xExpGroups }) => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const controller = new AbortController();
          timer = setTimeout(() => controller.abort(), timeoutMs);

          const headers: Record<string, string> = {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            "App-Name": "chatglm",
            Origin: "https://chatglm.cn",
            "X-App-Platform": "pc",
            "X-App-Version": "0.0.1",
            "X-App-fr": "default",
            "X-Device-Brand": "",
            "X-Device-Id": deviceId,
            "X-Device-Model": "",
            "X-Exp-Groups": xExpGroups,
            "X-Lang": "zh",
            "X-Nonce": sign.nonce,
            "X-Request-Id": requestId,
            "X-Sign": sign.sign,
            "X-Timestamp": sign.timestamp,
          };
          if (accessToken) {
            headers["Authorization"] = `Bearer ${accessToken}`;
          }

          const res = await fetch("https://chatglm.cn/chatglm/backend-api/assistant/stream", {
            method: "POST",
            headers,
            credentials: "include",
            body: bodyStr,
            signal: controller.signal,
          });
          clearTimeout(timer);

          if (!res.ok) {
            const errorText = await res.text();
            return {
              ok: false as const,
              status: res.status,
              error: errorText.substring(0, 500),
            };
          }

          const reader = res.body?.getReader();
          if (!reader) {
            return { ok: false as const, status: 500, error: "No response body" };
          }
          const decoder = new TextDecoder();
          let fullText = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            fullText += decoder.decode(value, { stream: true });
          }
          return { ok: true as const, data: fullText };
        } catch (err) {
          if (timer) clearTimeout(timer);
          return { ok: false as const, status: 500, error: String(err) };
        }
      },
      {
        accessToken: this.accessToken ?? null,
        bodyStr: JSON.stringify(body),
        deviceId: this.deviceId,
        requestId,
        timeoutMs: fetchTimeoutMs,
        sign,
        xExpGroups: X_EXP_GROUPS,
      },
    );

    const externalTimeoutMs = fetchTimeoutMs + 10_000;
    const responseData = await Promise.race([
      evalPromise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(new Error(`ChatGLM CN page.evaluate timed out after ${externalTimeoutMs}ms`)),
          externalTimeoutMs,
        ),
      ),
    ]);

    if (!responseData.ok) {
      if (responseData.status === 401 || responseData.status === 403) {
        // Rotate access token via refresh endpoint once, then bubble up
        // an auth error so the handler can retry with a fresh login if
        // refresh itself failed.
        await this.refreshAccessToken().catch(() => undefined);
        throw new Error(
          `ChatGLM CN API 401/403 (${responseData.status}): ${responseData.error ?? "unauthorized"}`,
        );
      }
      throw new Error(
        `ChatGLM CN API error: ${responseData.status} - ${responseData.error ?? "Request failed"}`,
      );
    }

    const encoder = new TextEncoder();
    const data = responseData.data ?? "";
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(data));
        controller.close();
      },
    });
  }

  async close(): Promise<void> {
    try {
      if (this.page && !this.page.isClosed()) await this.page.close().catch(() => undefined);
    } catch {
      /* ignore */
    }
    try {
      if (this.browser) await this.browser.close().catch(() => undefined);
    } catch {
      /* ignore */
    }
    if (this.running) stopChrome(this.running);
    this.page = null;
    this.browser = null;
    this.context = null;
    this.running = null;
    this.initialized = false;
  }
}
