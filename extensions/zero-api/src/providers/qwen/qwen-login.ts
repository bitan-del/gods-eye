import fs from "node:fs/promises";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import {
  launchChromeForLogin,
  stopChrome,
  type RunningChrome,
} from "../../browser/chrome-launcher.js";
import { zeroApiCredentialsDir } from "../../credentials/paths.js";
import {
  qwenWebCredentialPath,
  loadQwenWebCredentials,
  type QwenWebCredentials,
} from "./qwen-auth.js";

/**
 * Interactive login flow for Qwen Web (https://chat.qwen.ai, international).
 *
 * Launches a visible Chrome window with a persistent profile and waits for a
 * real authenticated signal — specifically an `Authorization: Bearer ...`
 * header on any `chat.qwen.ai/api/*` request. We do NOT gate on cookie count,
 * because chat.qwen.ai drops analytics/bot-detection cookies before sign-in,
 * which would make a cookie-based heuristic persist garbage credentials.
 */

type LoginResult = QwenWebCredentials;

type InFlight = { promise: Promise<LoginResult> };

let inflight: InFlight | null = null;

export function ensureQwenWebLogin(): Promise<LoginResult> {
  if (inflight) {
    return inflight.promise;
  }
  const promise = runLoginFlow().finally(() => {
    inflight = null;
  });
  inflight = { promise };
  return promise;
}

async function runLoginFlow(): Promise<LoginResult> {
  let running: RunningChrome | null = null;
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    console.info("[zero-api qwen-login] launching Chrome for interactive Qwen Web login...");
    running = await launchChromeForLogin({
      providerId: "qwen-web",
      startUrl: "https://chat.qwen.ai/",
    });

    browser = await chromium.connectOverCDP(running.wsUrl);
    context = browser.contexts()[0] ?? (await browser.newContext());

    const existing = context.pages().find((p) => p.url().includes("qwen.ai"));
    if (existing) {
      page = existing;
      await page.bringToFront().catch(() => undefined);
    } else {
      page = context.pages()[0] ?? (await context.newPage());
      try {
        await page.goto("https://chat.qwen.ai/", { timeout: 15000 });
      } catch {
        /* ignore; user may navigate manually */
      }
    }

    const userAgent = await page.evaluate(() => navigator.userAgent).catch(() => undefined);

    const creds = await waitForLogin(context, page);

    const persisted: QwenWebCredentials = {
      cookies: creds.cookies,
      bearer: creds.bearer,
      ...(userAgent ? { userAgent } : {}),
      capturedAt: Date.now(),
    };
    await persistCredentials(persisted);
    console.info("[zero-api qwen-login] captured and persisted Qwen Web session.");
    return persisted;
  } finally {
    try {
      if (page && !page.isClosed()) {
        await page.close().catch(() => undefined);
      }
    } catch {
      /* ignore */
    }
    try {
      if (browser) {
        await browser.close().catch(() => undefined);
      }
    } catch {
      /* ignore */
    }
    if (running) {
      stopChrome(running);
    }
  }
}

type CapturedAuth = {
  cookies: Record<string, string>;
  bearer: string;
};

async function waitForLogin(context: BrowserContext, page: Page): Promise<CapturedAuth> {
  const TIMEOUT_MS = 5 * 60 * 1000;
  const POLL_MS = 1000;
  const deadline = Date.now() + TIMEOUT_MS;

  let capturedBearer: string | undefined;
  page.on("request", (request) => {
    const url = request.url();
    if (!url.includes("chat.qwen.ai/api/")) return;
    const headers = request.headers();
    const auth = headers["authorization"];
    if (auth && auth.toLowerCase().startsWith("bearer ") && !capturedBearer) {
      const token = auth.slice(7).trim();
      // Qwen's anonymous visitor flow also stamps a short visitor bearer on
      // pre-login requests. Require a non-trivial token length (real JWT-ish)
      // to filter those out.
      if (token.length >= 32) {
        capturedBearer = token;
      }
    }
  });

  while (Date.now() < deadline) {
    if (page.isClosed()) {
      throw new Error("Browser window closed before Qwen Web login completed.");
    }
    if (capturedBearer) {
      let cookies: Awaited<ReturnType<BrowserContext["cookies"]>> = [];
      try {
        cookies = await context.cookies(["https://chat.qwen.ai", "https://qwen.ai"]);
      } catch {
        cookies = [];
      }
      const map: Record<string, string> = {};
      for (const c of cookies) {
        map[c.name] = c.value;
      }
      return { cookies: map, bearer: capturedBearer };
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error(
    "Qwen Web login timed out after 5 minutes. No authenticated Bearer token was observed — make sure you signed in fully and reached the chat interface.",
  );
}

async function persistCredentials(creds: QwenWebCredentials): Promise<void> {
  const dir = zeroApiCredentialsDir();
  await fs.mkdir(dir, { recursive: true });
  const file = qwenWebCredentialPath();
  const tmp = `${file}.tmp-${process.pid}`;
  await fs.writeFile(tmp, JSON.stringify(creds, null, 2), { mode: 0o600 });
  await fs.rename(tmp, file);
  try {
    await fs.chmod(file, 0o600);
  } catch {
    /* best effort */
  }
}

export async function loadOrLoginQwenWeb(): Promise<QwenWebCredentials> {
  const existing = await loadQwenWebCredentials();
  if (existing) {
    return existing;
  }
  return ensureQwenWebLogin();
}
