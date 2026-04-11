/**
 * Doubao (www.doubao.com / ByteDance) browser client.
 *
 * Runtime strategy: embedded persistent Playwright page.
 *
 * The samantha chat API (`/samantha/chat/completion`) is protected by
 * ByteDance's standard TLS-fingerprinting + WAF stack and rejects
 * node-side `fetch()` even with a complete cookie jar. The upstream
 * reference implementation (`doubao-web-client-browser.ts`) proves that
 * a `page.evaluate()` call from a logged-in browser page DOES go
 * through, so we mirror that approach: connect to the logged-in Chrome
 * profile via CDP, keep a Doubao page alive, and drive
 *
 *   POST https://www.doubao.com/samantha/chat/completion
 *
 * from inside the page. The upstream adds dynamic query params
 * (`aid=497858`, `device_platform=web`, etc.) that are needed by the
 * server — we replicate them exactly. The SSE body is buffered inside
 * the page and returned as a single ReadableStream chunk, which
 * `doubao-stream.ts` then splits back into `data:` lines. We buffer
 * rather than stream-pull because the caller reads synchronously
 * before `pull()` would ever be invoked.
 */

import crypto from "node:crypto";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import {
  launchChromeForLogin,
  stopChrome,
  type RunningChrome,
} from "../../browser/chrome-launcher.js";

export interface DoubaoWebClientOptions {
  sessionid: string;
  ttwid?: string;
  cookie?: string;
  userAgent?: string;
}

export class DoubaoWebClient {
  private sessionid: string;
  private ttwid: string | undefined;
  private cookie: string;
  private userAgent: string;
  private baseUrl = "https://www.doubao.com";
  private conversationId: string | null = null;

  private running: RunningChrome | null = null;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  constructor(options: DoubaoWebClientOptions | string) {
    let opts: DoubaoWebClientOptions;
    if (typeof options === "string") {
      try {
        opts = JSON.parse(options) as DoubaoWebClientOptions;
      } catch {
        throw new Error("DoubaoWebClient: cannot parse options string");
      }
    } else {
      opts = options;
    }
    this.sessionid = opts.sessionid;
    this.ttwid = opts.ttwid;
    this.cookie = opts.cookie || this.buildCookieString(opts.sessionid, opts.ttwid);
    this.userAgent = opts.userAgent || "Mozilla/5.0";
    if (!this.sessionid) throw new Error("Doubao sessionid is required");
    if (!this.cookie) throw new Error("Doubao cookie could not be built");
  }

  private buildCookieString(sessionid: string, ttwid?: string): string {
    if (!sessionid) return "";
    if (ttwid) return `sessionid=${sessionid}; ttwid=${ttwid}`;
    return `sessionid=${sessionid}`;
  }

  async init(): Promise<void> {
    if (this.browser && this.page) return;

    this.running = await launchChromeForLogin({
      providerId: "doubao-web",
      startUrl: "https://www.doubao.com/chat/",
    });
    this.browser = await chromium.connectOverCDP(this.running.wsUrl);
    this.context = this.browser.contexts()[0] ?? (await this.browser.newContext());

    // Seed cookies (in case the profile was cleared between runs).
    const cookies = this.cookie
      .split(";")
      .map((c) => c.trim())
      .filter((c) => c.includes("="))
      .map((c) => {
        const [name, ...rest] = c.split("=");
        return {
          name: (name ?? "").trim(),
          value: rest.join("=").trim(),
          domain: ".doubao.com",
          path: "/",
        };
      })
      .filter((c) => c.name.length > 0);
    if (cookies.length > 0) {
      try {
        await this.context.addCookies(cookies);
      } catch {
        /* best effort */
      }
    }

    const existing = this.context.pages().find((p) => p.url().includes("doubao.com"));
    if (existing) {
      this.page = existing;
    } else {
      this.page = await this.context.newPage();
      try {
        await this.page.goto("https://www.doubao.com/chat/", {
          waitUntil: "domcontentloaded",
          timeout: 120_000,
        });
      } catch {
        /* ignore */
      }
    }
  }

  async chatCompletions(params: {
    message: string;
    model?: string;
    signal?: AbortSignal;
  }): Promise<ReadableStream<Uint8Array>> {
    await this.init();
    if (!this.page) throw new Error("DoubaoWebClient: page not initialized");
    const page = this.page;

    const text = params.message;
    const requestBody = {
      messages: [
        {
          content: JSON.stringify({ text }),
          content_type: 2001,
          attachments: [],
          references: [],
        },
      ],
      completion_option: {
        is_regen: false,
        with_suggest: true,
        need_create_conversation: !this.conversationId,
        launch_stage: 1,
        is_replace: false,
        is_delete: false,
        message_from: 0,
        event_id: "0",
      },
      conversation_id: this.conversationId || "0",
      local_conversation_id: `local_16${Date.now().toString().slice(-14)}`,
      local_message_id: crypto.randomUUID(),
    };

    const responseData = await page.evaluate(
      async ({ baseUrl, body }) => {
        const qs = new URLSearchParams({
          aid: "497858",
          device_platform: "web",
          language: "zh",
          pkg_type: "release_version",
          real_aid: "497858",
          region: "CN",
          samantha_web: "1",
          sys_region: "CN",
          use_olympus_account: "1",
          version_code: "20800",
        });
        const url = `${baseUrl}/samantha/chat/completion?${qs.toString()}`;

        try {
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "text/event-stream",
              Referer: "https://www.doubao.com/chat/",
              Origin: "https://www.doubao.com",
              "Agw-js-conv": "str",
            },
            body: JSON.stringify(body),
          });
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
          return { ok: false as const, status: 500, error: String(err) };
        }
      },
      { baseUrl: this.baseUrl, body: requestBody },
    );

    if (!responseData.ok) {
      if (responseData.status === 401 || responseData.status === 403) {
        throw new Error(
          `Doubao API 401/403 (${responseData.status}): ${responseData.error ?? "unauthorized"}`,
        );
      }
      throw new Error(
        `Doubao API error: ${responseData.status} - ${responseData.error ?? "Request failed"}`,
      );
    }

    const data = responseData.data ?? "";

    // Extract conversation_id for subsequent turns.
    if (!this.conversationId && data) {
      try {
        const lines = data.split("\n");
        for (const line of lines) {
          if (line.startsWith("data:") && line.includes("conversation_id")) {
            const match = line.match(/"conversation_id"\s*:\s*"([^"]+)"/);
            if (match?.[1] && match[1] !== "0") {
              this.conversationId = match[1];
              break;
            }
          }
        }
      } catch {
        /* ignore */
      }
    }

    // Re-serialize to a ReadableStream the caller can read synchronously.
    // We enqueue line-by-line so the decoder can process them without
    // needing to split again.
    const encoder = new TextEncoder();
    const lines = data.split("\n");
    return new ReadableStream<Uint8Array>({
      start(controller) {
        for (const line of lines) {
          if (line) controller.enqueue(encoder.encode(line + "\n"));
        }
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
  }
}
