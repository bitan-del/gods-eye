import fs from "node:fs/promises";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import {
  launchChromeForLogin,
  stopChrome,
  type RunningChrome,
} from "../../browser/chrome-launcher.js";
import { zeroApiCredentialsDir } from "../../credentials/paths.js";
import {
  mimoWebCredentialPath,
  loadMimoWebCredentials,
  type MimoWebCredentials,
} from "./mimo-auth.js";

/**
 * Interactive login flow for Xiaomi MiMo Web (aistudio.xiaomimimo.com).
 *
 * Launches Chrome with a persistent profile keyed by `mimo-web` so that
 * subsequent runs reuse the session. A singleton mutex prevents concurrent
 * chat requests from opening multiple browser windows.
 *
 * Gating signal mirrors upstream xiaomimo-web-auth.ts: we only resolve once
 * we have observed either a Bearer token on a `xiaomimimo.com` request or
 * a captured `token`/`session`/`auth` value from the request/response flow.
 * Cookie-count heuristics are intentionally avoided.
 */

type LoginResult = MimoWebCredentials;

type InFlight = {
  promise: Promise<LoginResult>;
};

let inflight: InFlight | null = null;

export function ensureMimoWebLogin(): Promise<LoginResult> {
  if (inflight) return inflight.promise;
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
    console.info("[zero-api mimo-login] launching Chrome for interactive MiMo login...");
    running = await launchChromeForLogin({
      providerId: "mimo-web",
      startUrl: "https://aistudio.xiaomimimo.com/#/",
    });

    browser = await chromium.connectOverCDP(running.wsUrl);
    context = browser.contexts()[0] ?? (await browser.newContext());

    const existing = context.pages().find((p) => p.url().includes("xiaomimimo.com"));
    if (existing) {
      page = existing;
      await page.bringToFront().catch(() => undefined);
    } else {
      page = context.pages()[0] ?? (await context.newPage());
      try {
        await page.goto("https://aistudio.xiaomimimo.com/#/", { timeout: 15000 });
      } catch {
        /* ignore */
      }
    }

    const userAgent = await page.evaluate(() => navigator.userAgent).catch(() => undefined);

    const captured = await waitForLogin(context, page);

    const persisted: MimoWebCredentials = {
      cookies: captured.cookies,
      ...(captured.userToken ? { userToken: captured.userToken } : {}),
      ...(userAgent ? { userAgent } : {}),
      capturedAt: Date.now(),
    };
    await persistCredentials(persisted);
    console.info("[zero-api mimo-login] captured and persisted MiMo Web session.");
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

  // Strict gating: resolve only when an authenticated auth signal is seen.
  //
  // Primary signal: an `Authorization: Bearer <token>` header on any
  // request to xiaomimimo.com after login.
  // Secondary signal: a `token`/`session`/`auth` value observed inside a
  // json response body from xiaomimimo.com (upstream auth flow behavior).
  let capturedBearer: string | undefined;

  page.on("request", (request) => {
    const url = request.url();
    if (!url.includes("xiaomimimo.com")) return;
    const headers = request.headers();
    const auth = headers["authorization"] || headers["Authorization"];
    if (auth && auth.startsWith("Bearer ") && !capturedBearer) {
      capturedBearer = auth.slice(7);
    }
  });

  page.on("response", async (response) => {
    const url = response.url();
    if (!url.includes("xiaomimimo.com") || !response.ok()) return;
    const ct = response.headers()["content-type"] || "";
    if (!ct.includes("application/json")) return;
    try {
      const text = await response.text();
      const match = text.match(
        /(?:"accessToken"|"access_token"|"token"|"session_id")\s*:\s*"([^"]{16,})"/,
      );
      if (match && !capturedBearer) {
        capturedBearer = match[1];
      }
    } catch {
      /* ignore */
    }
  });

  while (Date.now() < deadline) {
    if (page.isClosed()) {
      throw new Error("Browser window closed before MiMo login completed.");
    }
    if (capturedBearer) {
      let cookies: Awaited<ReturnType<BrowserContext["cookies"]>> = [];
      try {
        cookies = await context.cookies([
          "https://aistudio.xiaomimimo.com",
          "https://xiaomimimo.com",
        ]);
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
    "MiMo Web login timed out after 5 minutes. No authenticated request was observed — make sure you signed in fully and reached the chat interface.",
  );
}

async function persistCredentials(creds: MimoWebCredentials): Promise<void> {
  const dir = zeroApiCredentialsDir();
  await fs.mkdir(dir, { recursive: true });
  const file = mimoWebCredentialPath();
  const tmp = `${file}.tmp-${process.pid}`;
  await fs.writeFile(tmp, JSON.stringify(creds, null, 2), { mode: 0o600 });
  await fs.rename(tmp, file);
  try {
    await fs.chmod(file, 0o600);
  } catch {
    /* best effort */
  }
}

export async function loadOrLoginMimoWeb(): Promise<MimoWebCredentials> {
  const existing = await loadMimoWebCredentials();
  if (existing) return existing;
  return ensureMimoWebLogin();
}
