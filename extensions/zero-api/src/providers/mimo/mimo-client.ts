import crypto from "node:crypto";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import {
  launchChromeForLogin,
  stopChrome,
  type RunningChrome,
} from "../../browser/chrome-launcher.js";

/**
 * Xiaomi MiMo Web client.
 *
 * IMPLEMENTATION NOTE: Unlike the DeepSeek client, this provider drives its
 * requests through a persistent Playwright page. The upstream reference
 * (`xiaomimo-web-client-browser.ts`) uses in-page XMLHttpRequest to bypass
 * Xiaomi's bot detection and to pick up the `xiaomichatbot_ph` cookie that
 * the SPA attaches to every chat request. Plain node fetch will not reach
 * the `/open-apis/bot/chat` endpoint.
 *
 * We cache the Browser/Context/Page per provider in module scope so repeated
 * chat requests reuse the same session. The persistent user-data-dir lives
 * under `~/.godseye/zero-api-browser-profile/mimo-web`, shared with the
 * login flow, so cookies captured at login are visible here too.
 */

const XIAOMIMO_BASE_URL = "https://aistudio.xiaomimimo.com";

const MODEL_MAP: Record<string, string> = {
  "xiaomimo-chat": "mimo-v2-flash-studio",
  "mimo-chat": "mimo-v2-flash-studio",
  "mimo-v2-flash": "mimo-v2-flash-studio",
  "mimo-v2-pro": "mimo-v2-pro-studio",
};

export interface MimoWebClientOptions {
  cookie: string;
  bearer?: string;
  userAgent?: string;
}

type RunningState = {
  running: RunningChrome;
  browser: Browser;
  context: BrowserContext;
  page: Page;
};

let shared: RunningState | null = null;

async function ensurePage(cookieHeader: string): Promise<RunningState> {
  if (shared) return shared;
  const running = await launchChromeForLogin({
    providerId: "mimo-web",
    startUrl: `${XIAOMIMO_BASE_URL}/#/`,
  });
  const browser = await chromium.connectOverCDP(running.wsUrl);
  const context = browser.contexts()[0] ?? (await browser.newContext());

  // Seed cookies from the captured jar if the persistent profile lost them.
  const pairs = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .filter((c) => c.includes("="))
    .map((c) => {
      const idx = c.indexOf("=");
      const name = c.slice(0, idx).trim();
      const value = c.slice(idx + 1).trim();
      return { name, value, domain: ".xiaomimimo.com", path: "/" };
    })
    .filter((c) => c.name.length > 0);
  if (pairs.length > 0) {
    try {
      await context.addCookies(pairs);
    } catch {
      /* ignore */
    }
  }

  const pages = context.pages();
  let page = pages.find((p) => p.url().includes("xiaomimimo.com"));
  if (!page) {
    page = pages[0] ?? (await context.newPage());
  }
  if (!page.url().includes("xiaomimimo.com")) {
    try {
      await page.goto(`${XIAOMIMO_BASE_URL}/#/`, { waitUntil: "domcontentloaded", timeout: 20000 });
    } catch {
      /* ignore */
    }
  }

  shared = { running, browser, context, page };
  return shared;
}

export class MimoWebClient {
  private cookie: string;
  private userAgent: string;
  private conversationId: string | null = null;

  constructor(options: MimoWebClientOptions | string) {
    let finalOptions: MimoWebClientOptions;
    if (typeof options === "string") {
      try {
        const parsed = JSON.parse(options) as MimoWebClientOptions | string;
        finalOptions = typeof parsed === "string" ? { cookie: parsed } : parsed;
      } catch {
        finalOptions = { cookie: options };
      }
    } else {
      finalOptions = options;
    }
    this.cookie = finalOptions.cookie || "";
    this.userAgent =
      finalOptions.userAgent ||
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
  }

  async init(): Promise<void> {
    await ensurePage(this.cookie);
  }

  async chatCompletions(params: {
    conversationId?: string;
    message: string;
    model?: string;
    signal?: AbortSignal;
  }): Promise<ReadableStream<Uint8Array>> {
    const state = await ensurePage(this.cookie);
    const modelInternal = MODEL_MAP[params.model ?? ""] || params.model || "mimo-v2-flash-studio";
    const convId = params.conversationId || this.conversationId || "0";
    const msgId = crypto.randomUUID().replace(/-/g, "");

    const result = await state.page.evaluate(
      async (input: { message: string; modelInternal: string; convId: string; msgId: string }) => {
        const botPhMatch = document.cookie.match(/xiaomichatbot_ph=([^;]+)/);
        const botPh = botPhMatch?.[1] || "";
        const url = `/open-apis/bot/chat?xiaomichatbot_ph=${encodeURIComponent(botPh)}`;
        const body = {
          msgId: input.msgId,
          conversationId: input.convId,
          query: input.message,
          isEditedQuery: false,
          modelConfig: {
            enableThinking: false,
            webSearchStatus: "disabled",
            model: input.modelInternal,
            temperature: 0.8,
            topP: 0.95,
          },
          multiMedias: [],
        };

        return new Promise<{
          ok: boolean;
          status: number;
          data: string;
          convId?: string;
          error?: string;
        }>((resolve) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", url, true);
          xhr.setRequestHeader("Content-Type", "application/json");
          xhr.setRequestHeader("Accept", "text/event-stream, */*");
          xhr.withCredentials = true;

          let resolved = false;
          const timer = setTimeout(() => {
            if (!resolved) {
              resolved = true;
              resolve({
                ok: xhr.responseText.length > 0,
                status: xhr.status,
                data: xhr.responseText,
              });
            }
          }, 45000);

          xhr.addEventListener("load", () => {
            if (resolved) return;
            resolved = true;
            clearTimeout(timer);
            let newConvId: string | undefined;
            const convMatch = xhr.responseText.match(/conversationId['":\s]+['"]?([a-f0-9]+)/);
            if (convMatch) newConvId = convMatch[1];
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve({
                ok: true,
                status: xhr.status,
                data: xhr.responseText,
                convId: newConvId,
              });
            } else {
              resolve({
                ok: false,
                status: xhr.status,
                data: xhr.responseText,
                error: `HTTP ${xhr.status}`,
              });
            }
          });

          xhr.addEventListener("error", () => {
            if (resolved) return;
            resolved = true;
            clearTimeout(timer);
            resolve({ ok: false, status: 0, data: "", error: "XHR error" });
          });

          xhr.send(JSON.stringify(body));
        });
      },
      {
        message: params.message,
        modelInternal,
        convId,
        msgId,
      },
    );

    if (result.convId) {
      this.conversationId = result.convId;
    }

    if (!result.ok) {
      if (result.status === 401 || result.status === 403) {
        throw new Error(`MiMo auth failed: ${result.status} ${result.error || ""}`);
      }
      throw new Error(`MiMo API error ${result.status}: ${result.error || "no response"}`);
    }

    const encoder = new TextEncoder();
    return new ReadableStream<Uint8Array>({
      start(controller) {
        if (result.data) controller.enqueue(encoder.encode(result.data));
        controller.close();
      },
    });
  }
}

/** Tear down the shared Chrome instance. Intended for graceful shutdown. */
export async function closeMimoSharedBrowser(): Promise<void> {
  if (!shared) return;
  try {
    await shared.browser.close();
  } catch {
    /* ignore */
  }
  try {
    stopChrome(shared.running);
  } catch {
    /* ignore */
  }
  shared = null;
}
