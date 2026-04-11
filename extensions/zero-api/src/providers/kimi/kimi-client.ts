import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import {
  launchChromeForLogin,
  stopChrome,
  type RunningChrome,
} from "../../browser/chrome-launcher.js";

/**
 * Kimi Web client (www.kimi.com).
 *
 * Runtime path: persistent Playwright page.
 *
 * Kimi's chat endpoint is a Connect-RPC service at
 * `/apiv2/kimi.gateway.chat.v1.ChatService/Chat` that uses the `connect+json`
 * framing (5-byte length prefix + JSON chunks). Reproducing that framing from
 * Node works in isolation, but Kimi's CDN enforces strict Origin / Referer /
 * cookie pairing that is easier to satisfy from inside a live browser context.
 * To match the upstream reference implementation and keep bot detection
 * happy, we run the actual request from `page.evaluate()` using the browser's
 * native fetch.
 *
 * The page is opened once on first chat turn and reused for subsequent turns.
 */

export interface KimiWebClientOptions {
  cookie: string;
  accessToken: string;
  userAgent?: string;
}

type BrowserState = {
  running: RunningChrome;
  browser: Browser;
  context: BrowserContext;
  page: Page;
};

type KimiResponse = { ok: true; text: string } | { ok: false; error: string };

export class KimiWebClient {
  private cookie: string;
  private accessToken: string;
  private userAgent: string;
  private baseUrl = "https://www.kimi.com";
  private state: BrowserState | null = null;

  constructor(options: KimiWebClientOptions) {
    this.cookie = options.cookie;
    this.accessToken = options.accessToken;
    this.userAgent =
      options.userAgent ||
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  }

  private async ensureBrowser(): Promise<BrowserState> {
    if (this.state) return this.state;

    const running = await launchChromeForLogin({
      providerId: "kimi-web",
      startUrl: "https://www.kimi.com/",
    });
    const browser = await chromium.connectOverCDP(running.wsUrl);
    const context = browser.contexts()[0] ?? (await browser.newContext());

    const cookieEntries = this.cookie
      .split(";")
      .map((part) => part.trim())
      .filter((part) => part.includes("="))
      .map((part) => {
        const idx = part.indexOf("=");
        const name = part.slice(0, idx).trim();
        const value = part.slice(idx + 1).trim();
        const domain = name.startsWith("__Host-") ? "www.kimi.com" : ".kimi.com";
        const entry: {
          name: string;
          value: string;
          domain: string;
          path: string;
          secure?: boolean;
        } = { name, value, domain, path: "/" };
        if (name.startsWith("__Secure-") || name.startsWith("__Host-")) {
          entry.secure = true;
        }
        return entry;
      })
      .filter((c) => c.name.length > 0);
    if (cookieEntries.length > 0) {
      try {
        await context.addCookies(cookieEntries);
      } catch (err) {
        console.warn(
          `[zero-api kimi] addCookies failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const existing = context.pages().find((p) => p.url().includes("kimi.com"));
    const page = existing ?? (await context.newPage());
    if (!existing) {
      try {
        await page.goto(`${this.baseUrl}/`, { waitUntil: "domcontentloaded" });
      } catch {
        /* ignore */
      }
    }

    // Seed localStorage.access_token so the SPA (and any `credentials: include`
    // fetches we proxy) are consistent with the captured session.
    if (this.accessToken) {
      try {
        await page.evaluate(
          (token) => localStorage.setItem("access_token", token),
          this.accessToken,
        );
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

    const scenario = params.model.includes("search")
      ? "SCENARIO_SEARCH"
      : params.model.includes("research")
        ? "SCENARIO_RESEARCH"
        : params.model.includes("k1")
          ? "SCENARIO_K1"
          : "SCENARIO_K2";

    const result = (await page.evaluate(
      async ({
        baseUrl,
        message,
        kimiAuthToken,
        scenario,
      }: {
        baseUrl: string;
        message: string;
        kimiAuthToken: string;
        scenario: string;
      }): Promise<{ ok: true; text: string } | { ok: false; error: string }> => {
        try {
          const req = {
            scenario,
            message: {
              role: "user" as const,
              blocks: [{ message_id: "", text: { content: message } }],
              scenario,
            },
            options: { thinking: false },
          };
          const enc = new TextEncoder().encode(JSON.stringify(req));
          const buf = new ArrayBuffer(5 + enc.byteLength);
          const dv = new DataView(buf);
          dv.setUint8(0, 0x00);
          dv.setUint32(1, enc.byteLength, false);
          new Uint8Array(buf, 5).set(enc);

          const res = await fetch(`${baseUrl}/apiv2/kimi.gateway.chat.v1.ChatService/Chat`, {
            method: "POST",
            headers: {
              "Content-Type": "application/connect+json",
              "Connect-Protocol-Version": "1",
              Accept: "*/*",
              Origin: baseUrl,
              Referer: `${baseUrl}/`,
              "X-Language": "zh-CN",
              "X-Msh-Platform": "web",
              Authorization: `Bearer ${kimiAuthToken}`,
            },
            body: buf,
          });

          if (!res.ok) {
            const text = await res.text();
            return { ok: false, error: `${res.status}: ${text.slice(0, 400)}` };
          }
          const arr = await res.arrayBuffer();
          const u8 = new Uint8Array(arr);
          const texts: string[] = [];
          let o = 0;
          while (o + 5 <= u8.length) {
            const len = new DataView(u8.buffer, u8.byteOffset + o + 1, 4).getUint32(0, false);
            if (o + 5 + len > u8.length) break;
            const chunk = u8.slice(o + 5, o + 5 + len);
            try {
              const obj = JSON.parse(new TextDecoder().decode(chunk)) as {
                op?: string;
                block?: { text?: { content?: string } };
                text?: { content?: string };
                message?: {
                  role?: string;
                  blocks?: Array<{ text?: { content?: string } }>;
                };
                done?: boolean;
                error?: { message?: string; code?: string };
              };
              if (obj.error) {
                return {
                  ok: false,
                  error:
                    obj.error.message || obj.error.code || JSON.stringify(obj.error).slice(0, 200),
                };
              }
              const op = obj.op || "";
              if (obj.block?.text?.content && (op === "append" || op === "set")) {
                texts.push(obj.block.text.content);
              } else if (obj.text?.content && (op === "append" || op === "set")) {
                texts.push(obj.text.content);
              }
              if (!op && obj.message?.role === "assistant" && obj.message?.blocks) {
                for (const blk of obj.message.blocks) {
                  if (blk.text?.content) {
                    texts.push(blk.text.content);
                  }
                }
              }
              if (obj.done) break;
            } catch {
              /* ignore non-JSON chunks */
            }
            o += 5 + len;
          }
          return { ok: true, text: texts.join("") };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },
      {
        baseUrl: this.baseUrl,
        message: params.message,
        kimiAuthToken: this.accessToken,
        scenario,
      },
    )) as KimiResponse;

    if (!result.ok) {
      throw new Error(`Kimi chat error: ${result.error}`);
    }

    // Wrap the fully-collected text into a single-frame SSE stream so the
    // downstream parser can stay uniform with other providers.
    const encoder = new TextEncoder();
    const escaped = JSON.stringify(result.text);
    const sse = `data: {"text":${escaped}}\n\ndata: [DONE]\n\n`;
    return new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sse));
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
