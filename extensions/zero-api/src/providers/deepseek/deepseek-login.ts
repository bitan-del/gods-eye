import fs from "node:fs/promises";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import {
  launchChromeForLogin,
  stopChrome,
  type RunningChrome,
} from "../../browser/chrome-launcher.js";
import { zeroApiCredentialsDir } from "../../credentials/paths.js";
import {
  deepSeekWebCredentialPath,
  loadDeepSeekWebCredentials,
  type DeepSeekWebCredentials,
} from "./deepseek-auth.js";

/**
 * Interactive login flow for DeepSeek Web.
 *
 * Launches a visible Chrome window with a persistent user-data-dir so that
 * subsequent runs reuse the logged-in session without bothering the user
 * again. A singleton mutex prevents multiple concurrent chat requests from
 * opening multiple browser windows.
 *
 * Logged-in detection mirrors the upstream auth file at
 * /tmp/zero-token-upstream/deepseek-web-auth.ts. We look for any of the known
 * session cookies (`d_id`, `ds_session_id`, `HWSID`, `uuid`) or a successful
 * response from https://chat.deepseek.com/api/v0/users/current.
 */

type LoginResult = DeepSeekWebCredentials;

type InFlight = {
  promise: Promise<LoginResult>;
};

let inflight: InFlight | null = null;

/**
 * Serialize concurrent login attempts through a single promise. While a login
 * is already in progress, any additional caller just awaits that same promise.
 */
export function ensureDeepSeekWebLogin(): Promise<LoginResult> {
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
    console.info("[zero-api deepseek-login] launching Chrome for interactive DeepSeek login...");
    running = await launchChromeForLogin({
      providerId: "deepseek-web",
      startUrl: "https://chat.deepseek.com/sign_in",
    });

    browser = await chromium.connectOverCDP(running.wsUrl);
    context = browser.contexts()[0] ?? (await browser.newContext());

    // Reuse any existing DeepSeek tab if Chrome restored one from the profile.
    const existing = context.pages().find((p) => p.url().includes("deepseek.com"));
    if (existing) {
      page = existing;
      await page.bringToFront().catch(() => undefined);
    } else {
      page = context.pages()[0] ?? (await context.newPage());
      try {
        await page.goto("https://chat.deepseek.com/sign_in", { timeout: 15000 });
      } catch {
        /* ignore; user may navigate manually */
      }
    }

    const userAgent = await page.evaluate(() => navigator.userAgent).catch(() => undefined);

    const creds = await waitForLogin(context, page);

    const persisted: DeepSeekWebCredentials = {
      cookies: creds.cookies,
      ...(creds.userToken ? { userToken: creds.userToken } : {}),
      ...(userAgent ? { userAgent } : {}),
      capturedAt: Date.now(),
    };
    await persistCredentials(persisted);
    console.info("[zero-api deepseek-login] captured and persisted DeepSeek Web session.");
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

type CapturedCookies = {
  cookies: Record<string, string>;
  userToken?: string;
};

async function waitForLogin(context: BrowserContext, page: Page): Promise<CapturedCookies> {
  const TIMEOUT_MS = 5 * 60 * 1000;
  const POLL_MS = 1000;
  const deadline = Date.now() + TIMEOUT_MS;

  // Gating signal: DeepSeek's SPA only issues authenticated `/api/v0/*`
  // requests (with an Authorization Bearer header) AFTER the user has
  // actually signed in. It also returns `data.biz_data.token` from
  // `/api/v0/users/current` once the session is live. We mirror the
  // upstream deepseek-web-auth flow and resolve only when that token has
  // been observed — anonymous cookies from bot detection (HWSID, uuid, Hm_*)
  // are intentionally NOT treated as a logged-in signal.
  let capturedBearer: string | undefined;
  page.on("request", (request) => {
    const url = request.url();
    if (!url.includes("/api/v0/")) return;
    const headers = request.headers();
    const auth = headers["authorization"];
    if (auth && auth.startsWith("Bearer ") && !capturedBearer) {
      capturedBearer = auth.slice(7);
    }
  });
  page.on("response", async (response) => {
    const url = response.url();
    if (!url.includes("/api/v0/users/current") || !response.ok()) return;
    try {
      const body = (await response.json()) as Record<string, unknown>;
      const data = body?.data as Record<string, unknown> | undefined;
      const bizData = data?.biz_data as Record<string, unknown> | undefined;
      const token = bizData?.token;
      if (typeof token === "string" && token.length > 0 && !capturedBearer) {
        capturedBearer = token;
      }
    } catch {
      /* ignore */
    }
  });

  while (Date.now() < deadline) {
    if (page.isClosed()) {
      throw new Error("Browser window closed before DeepSeek login completed.");
    }
    // Only resolve once we've seen a real auth bearer token from the SPA.
    // Cookies alone are never sufficient — DeepSeek drops several anonymous
    // cookies (bot detection, analytics) before login, and relying on cookie
    // count or presence creates false-positives that persist garbage creds.
    if (capturedBearer) {
      let cookies: Awaited<ReturnType<BrowserContext["cookies"]>> = [];
      try {
        cookies = await context.cookies(["https://chat.deepseek.com", "https://deepseek.com"]);
      } catch {
        cookies = [];
      }
      const map: Record<string, string> = {};
      for (const c of cookies) {
        map[c.name] = c.value;
      }
      return { cookies: map, userToken: capturedBearer };
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error(
    "DeepSeek Web login timed out after 5 minutes. No authenticated API request was observed — make sure you signed in fully and reached the chat interface.",
  );
}

async function persistCredentials(creds: DeepSeekWebCredentials): Promise<void> {
  const dir = zeroApiCredentialsDir();
  await fs.mkdir(dir, { recursive: true });
  const file = deepSeekWebCredentialPath();
  const tmp = `${file}.tmp-${process.pid}`;
  await fs.writeFile(tmp, JSON.stringify(creds, null, 2), { mode: 0o600 });
  await fs.rename(tmp, file);
  try {
    await fs.chmod(file, 0o600);
  } catch {
    /* best effort */
  }
}

/**
 * Convenience helper: load creds from disk first; if missing, drive the login
 * flow. Used by the shim before dispatching a chat completion.
 */
export async function loadOrLoginDeepSeekWeb(): Promise<DeepSeekWebCredentials> {
  const existing = await loadDeepSeekWebCredentials();
  if (existing) {
    return existing;
  }
  return ensureDeepSeekWebLogin();
}
