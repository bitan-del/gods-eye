import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import {
  launchChromeForLogin,
  stopChrome,
  type RunningChrome,
} from "../../browser/chrome-launcher.js";

/**
 * Qwen CN Web client (chat2.qianwen.com, 国内版).
 *
 * Runtime path: persistent Playwright page.
 *
 * The CN chat2 API is NOT reachable from plain Node `fetch()`. Every request
 * carries a `x-deviceid` + `x-xsrf-token` + signed `nonce`/`timestamp` query
 * params, uses `credentials: "include"`, and the server enforces Alibaba's
 * EX015 web-signature check. Reproducing that signature flow outside the
 * browser is brittle. Instead we keep a persistent Chrome page open (reusing
 * the same credential profile we used for login) and run the fetch() from
 * inside `page.evaluate()` — exactly like the upstream client does.
 *
 * The page is launched lazily on first request, pointed at qianwen.com with
 * the captured cookies injected, and reused across chat turns.
 */

export interface QwenCnWebClientOptions {
  cookie: string;
  xsrfToken: string;
  ut: string;
  userAgent?: string;
}

type BrowserState = {
  running: RunningChrome;
  browser: Browser;
  context: BrowserContext;
  page: Page;
};

export class QwenCnWebClient {
  private cookie: string;
  private xsrfToken: string;
  private ut: string;
  private deviceId: string;
  private userAgent: string;
  private baseUrl = "https://chat2.qianwen.com";
  private state: BrowserState | null = null;

  constructor(options: QwenCnWebClientOptions) {
    this.cookie = options.cookie;
    this.xsrfToken = options.xsrfToken;
    this.ut = options.ut;
    this.deviceId = this.ut || `random-${Math.random().toString(36).slice(2)}`;
    this.userAgent =
      options.userAgent ||
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  }

  private async ensureBrowser(): Promise<BrowserState> {
    if (this.state) return this.state;

    const running = await launchChromeForLogin({
      providerId: "qwen-cn-web",
      startUrl: "https://www.qianwen.com/",
    });
    const browser = await chromium.connectOverCDP(running.wsUrl);
    const context = browser.contexts()[0] ?? (await browser.newContext());

    // Hydrate any cookies we captured at login into this context (the profile
    // dir itself may already carry them, but this is cheap insurance).
    const cookieEntries = this.cookie
      .split(";")
      .map((part) => part.trim())
      .filter((part) => part.includes("="))
      .map((part) => {
        const idx = part.indexOf("=");
        return {
          name: part.slice(0, idx).trim(),
          value: part.slice(idx + 1).trim(),
          domain: ".qianwen.com",
          path: "/",
        };
      })
      .filter((c) => c.name.length > 0);
    if (cookieEntries.length > 0) {
      try {
        await context.addCookies(cookieEntries);
      } catch (err) {
        console.warn(
          `[zero-api qwen-cn] addCookies failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const existing = context.pages().find((p) => p.url().includes("qianwen.com"));
    const page = existing ?? (await context.newPage());
    if (!existing) {
      try {
        await page.goto("https://www.qianwen.com/", { waitUntil: "domcontentloaded" });
      } catch {
        /* ignore */
      }
    }

    this.state = { running, browser, context, page };
    return this.state;
  }

  async init(): Promise<void> {
    await this.ensureBrowser();
  }

  async chatCompletions(params: {
    message: string;
    model: string;
    signal?: AbortSignal;
  }): Promise<ReadableStream<Uint8Array>> {
    const { page } = await this.ensureBrowser();

    const sessionId = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join("");
    const timestamp = Date.now();
    const nonce = Math.random().toString(36).slice(2);

    const responseData = await page.evaluate(
      async ({
        baseUrl,
        sessionId,
        model,
        message,
        ut,
        xsrfToken,
        deviceId,
        nonce,
        timestamp,
      }: {
        baseUrl: string;
        sessionId: string;
        model: string;
        message: string;
        ut: string;
        xsrfToken: string;
        deviceId: string;
        nonce: string;
        timestamp: number;
      }) => {
        try {
          const url = `${baseUrl}/api/v2/chat?biz_id=ai_qwen&chat_client=h5&device=pc&fr=pc&pr=qwen&nonce=${nonce}&timestamp=${timestamp}&ut=${ut}`;
          const body = {
            model,
            messages: [
              {
                content: message,
                mime_type: "text/plain",
                meta_data: { ori_query: message },
              },
            ],
            session_id: sessionId,
            parent_req_id: "0",
            deep_search: "0",
            req_id: `req-${Math.random().toString(36).slice(2)}`,
            scene: "chat",
            sub_scene: "chat",
            temporary: false,
            from: "default",
            scene_param: "first_turn",
            chat_client: "h5",
            client_tm: timestamp.toString(),
            protocol_version: "v2",
            biz_id: "ai_qwen",
          };
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "text/event-stream, text/plain, */*",
              Referer: `${baseUrl}/`,
              Origin: baseUrl,
              "x-xsrf-token": xsrfToken,
              "x-deviceid": deviceId,
              "x-platform": "pc_tongyi",
              "x-req-from": "pc_web",
            },
            body: JSON.stringify(body),
            credentials: "include",
          });
          if (!res.ok) {
            const errorText = await res.text();
            return { ok: false, status: res.status, error: errorText };
          }
          const reader = res.body?.getReader();
          if (!reader) {
            return { ok: false, status: 500, error: "No response body" };
          }
          const decoder = new TextDecoder();
          let fullText = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            fullText += decoder.decode(value, { stream: true });
          }
          return { ok: true, data: fullText };
        } catch (err) {
          return { ok: false, status: 500, error: String(err) };
        }
      },
      {
        baseUrl: this.baseUrl,
        sessionId,
        model: params.model,
        message: params.message,
        ut: this.ut,
        xsrfToken: this.xsrfToken,
        deviceId: this.deviceId,
        nonce,
        timestamp,
      },
    );

    if (!responseData || !responseData.ok) {
      throw new Error(
        `Qwen CN chat error: ${responseData?.status ?? "unknown"} ${
          responseData?.error?.slice(0, 300) ?? "request failed"
        }`,
      );
    }

    const encoder = new TextEncoder();
    return new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(responseData.data ?? ""));
        controller.close();
      },
    });
  }

  async close(): Promise<void> {
    if (!this.state) return;
    try {
      await this.state.browser.close().catch(() => undefined);
    } catch {
      /* ignore */
    }
    stopChrome(this.state.running);
    this.state = null;
  }
}
