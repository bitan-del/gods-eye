import fs from "node:fs/promises";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import {
  launchChromeForLogin,
  stopChrome,
  type RunningChrome,
} from "../../browser/chrome-launcher.js";
import { zeroApiCredentialsDir } from "../../credentials/paths.js";
import {
  kimiWebCredentialPath,
  loadKimiWebCredentials,
  type KimiWebCredentials,
} from "./kimi-auth.js";

/**
 * Interactive login flow for Kimi Web (https://www.kimi.com).
 *
 * Gating signal: the Kimi SPA stores an `access_token` in localStorage the
 * moment the user successfully signs in, and starts sending
 * `Authorization: Bearer <access_token>` on every `/apiv2/*` request. We
 * gate on observing either:
 *   - a non-empty `localStorage.access_token`, OR
 *   - a `kimi-auth` cookie on kimi.com AND a real authenticated `/apiv2/*`
 *     request with a Bearer header.
 * Cookie presence alone is insufficient because Kimi drops anonymous
 * analytics cookies before sign-in.
 */

type LoginResult = KimiWebCredentials;
type InFlight = { promise: Promise<LoginResult> };

let inflight: InFlight | null = null;

export function ensureKimiWebLogin(): Promise<LoginResult> {
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
    console.info("[zero-api kimi-login] launching Chrome for interactive Kimi login...");
    running = await launchChromeForLogin({
      providerId: "kimi-web",
      startUrl: "https://www.kimi.com/",
    });

    browser = await chromium.connectOverCDP(running.wsUrl);
    context = browser.contexts()[0] ?? (await browser.newContext());

    const existing = context
      .pages()
      .find((p) => p.url().includes("kimi.com") || p.url().includes("moonshot.cn"));
    if (existing) {
      page = existing;
      await page.bringToFront().catch(() => undefined);
    } else {
      page = context.pages()[0] ?? (await context.newPage());
      try {
        await page.goto("https://www.kimi.com/", { timeout: 15000 });
      } catch {
        /* ignore */
      }
    }

    const userAgent = await page.evaluate(() => navigator.userAgent).catch(() => undefined);
    const captured = await waitForLogin(context, page);

    const persisted: KimiWebCredentials = {
      cookies: captured.cookies,
      ...(captured.accessToken ? { accessToken: captured.accessToken } : {}),
      ...(captured.refreshToken ? { refreshToken: captured.refreshToken } : {}),
      ...(userAgent ? { userAgent } : {}),
      capturedAt: Date.now(),
    };
    await persistCredentials(persisted);
    console.info("[zero-api kimi-login] captured and persisted Kimi Web session.");
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
  accessToken?: string;
  refreshToken?: string;
};

async function waitForLogin(context: BrowserContext, page: Page): Promise<CapturedAuth> {
  const TIMEOUT_MS = 5 * 60 * 1000;
  const POLL_MS = 1000;
  const deadline = Date.now() + TIMEOUT_MS;

  let capturedBearer: string | undefined;
  page.on("request", (request) => {
    const url = request.url();
    if (!url.includes("kimi.com/apiv2/") && !url.includes("moonshot.cn/apiv2/")) {
      return;
    }
    const headers = request.headers();
    const auth = headers["authorization"];
    if (auth && auth.toLowerCase().startsWith("bearer ") && !capturedBearer) {
      const token = auth.slice(7).trim();
      if (token.length >= 16) {
        capturedBearer = token;
      }
    }
  });

  while (Date.now() < deadline) {
    if (page.isClosed()) {
      throw new Error("Browser window closed before Kimi login completed.");
    }

    // Primary gating: localStorage.access_token.
    let accessToken: string | undefined;
    let refreshToken: string | undefined;
    try {
      const ls = await page.evaluate(() => ({
        access: localStorage.getItem("access_token"),
        refresh: localStorage.getItem("refresh_token"),
      }));
      if (typeof ls.access === "string" && ls.access.length > 0) {
        accessToken = ls.access;
      }
      if (typeof ls.refresh === "string" && ls.refresh.length > 0) {
        refreshToken = ls.refresh;
      }
    } catch {
      /* ignore */
    }

    const haveAuthSignal =
      !!accessToken || (!!capturedBearer && (await hasKimiAuthCookie(context)));

    if (haveAuthSignal) {
      let cookies: Awaited<ReturnType<BrowserContext["cookies"]>> = [];
      try {
        cookies = await context.cookies([
          "https://www.kimi.com",
          "https://kimi.com",
          "https://moonshot.cn",
        ]);
      } catch {
        cookies = [];
      }
      const map: Record<string, string> = {};
      for (const c of cookies) {
        map[c.name] = c.value;
      }
      return {
        cookies: map,
        ...(accessToken ? { accessToken } : capturedBearer ? { accessToken: capturedBearer } : {}),
        ...(refreshToken ? { refreshToken } : {}),
      };
    }

    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error(
    "Kimi Web login timed out after 5 minutes. No access_token / authenticated API call was observed — make sure you signed in fully and reached the chat interface.",
  );
}

async function hasKimiAuthCookie(context: BrowserContext): Promise<boolean> {
  try {
    const cookies = await context.cookies(["https://www.kimi.com", "https://kimi.com"]);
    return cookies.some((c) => c.name === "kimi-auth" && c.value.length > 0);
  } catch {
    return false;
  }
}

async function persistCredentials(creds: KimiWebCredentials): Promise<void> {
  const dir = zeroApiCredentialsDir();
  await fs.mkdir(dir, { recursive: true });
  const file = kimiWebCredentialPath();
  const tmp = `${file}.tmp-${process.pid}`;
  await fs.writeFile(tmp, JSON.stringify(creds, null, 2), { mode: 0o600 });
  await fs.rename(tmp, file);
  try {
    await fs.chmod(file, 0o600);
  } catch {
    /* best effort */
  }
}

export async function loadOrLoginKimiWeb(): Promise<KimiWebCredentials> {
  const existing = await loadKimiWebCredentials();
  if (existing) return existing;
  return ensureKimiWebLogin();
}
