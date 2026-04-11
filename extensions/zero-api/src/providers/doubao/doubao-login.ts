import fs from "node:fs/promises";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import {
  launchChromeForLogin,
  stopChrome,
  type RunningChrome,
} from "../../browser/chrome-launcher.js";
import { zeroApiCredentialsDir } from "../../credentials/paths.js";
import {
  doubaoWebCredentialPath,
  loadDoubaoWebCredentials,
  type DoubaoWebCredentials,
} from "./doubao-auth.js";

/**
 * Interactive login flow for Doubao (www.doubao.com / ByteDance).
 *
 * The canonical logged-in signal (per upstream `doubao-web-auth.ts`) is
 * the `sessionid` cookie on `.doubao.com`. It is only set after a
 * successful user login, and the samantha chat API rejects any request
 * without it. Anonymous bot-detection cookies (`ttwid`, `s_v_web_id`) are
 * NOT treated as proof of login.
 */

type LoginResult = DoubaoWebCredentials;

type InFlight = { promise: Promise<LoginResult> };
let inflight: InFlight | null = null;

export function ensureDoubaoWebLogin(): Promise<LoginResult> {
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
    console.info("[zero-api doubao-web] launching Chrome for interactive Doubao login...");
    running = await launchChromeForLogin({
      providerId: "doubao-web",
      startUrl: "https://www.doubao.com/chat/",
    });

    browser = await chromium.connectOverCDP(running.wsUrl);
    context = browser.contexts()[0] ?? (await browser.newContext());

    const existing = context.pages().find((p) => p.url().includes("doubao.com"));
    if (existing) {
      page = existing;
      await page.bringToFront().catch(() => undefined);
    } else {
      page = context.pages()[0] ?? (await context.newPage());
      try {
        await page.goto("https://www.doubao.com/chat/", { timeout: 15_000 });
      } catch {
        /* ignore */
      }
    }

    const userAgent = await page.evaluate(() => navigator.userAgent).catch(() => undefined);

    const captured = await waitForLogin(context, page);

    const persisted: DoubaoWebCredentials = {
      cookies: captured.cookies,
      sessionid: captured.sessionid,
      ...(captured.ttwid ? { ttwid: captured.ttwid } : {}),
      ...(userAgent ? { userAgent } : {}),
      capturedAt: Date.now(),
    };
    await persistCredentials(persisted);
    console.info("[zero-api doubao-web] captured and persisted Doubao session.");
    return persisted;
  } finally {
    try {
      if (page && !page.isClosed()) await page.close().catch(() => undefined);
    } catch {
      /* ignore */
    }
    try {
      if (browser) await browser.close().catch(() => undefined);
    } catch {
      /* ignore */
    }
    if (running) stopChrome(running);
  }
}

type CapturedCreds = {
  cookies: Record<string, string>;
  sessionid: string;
  ttwid?: string;
};

async function waitForLogin(context: BrowserContext, page: Page): Promise<CapturedCreds> {
  const TIMEOUT_MS = 5 * 60 * 1000;
  const POLL_MS = 1000;
  const deadline = Date.now() + TIMEOUT_MS;

  // Also track authenticated samantha/* responses as a secondary confirmation
  // that the session actually works for the real API — this avoids false
  // positives where sessionid is set but the server considers it invalid.
  let sawAuthenticatedSamantha = false;
  page.on("response", (response) => {
    const url = response.url();
    if (!url.includes("doubao.com/samantha/")) return;
    if (response.ok()) sawAuthenticatedSamantha = true;
  });

  while (Date.now() < deadline) {
    if (page.isClosed()) {
      throw new Error("Browser window closed before Doubao login completed.");
    }

    let cookieMap: Record<string, string> = {};
    let sessionid: string | undefined;
    let ttwid: string | undefined;
    try {
      const cookies = await context.cookies(["https://www.doubao.com", "https://doubao.com"]);
      for (const c of cookies) {
        cookieMap[c.name] = c.value;
        if (c.name === "sessionid" && c.value) sessionid = c.value;
        if (c.name === "ttwid" && c.value) ttwid = c.value;
      }
    } catch {
      cookieMap = {};
    }

    // sessionid is the canonical logged-in cookie. Observing an
    // authenticated samantha/* response is a bonus but not required.
    if (sessionid) {
      return {
        cookies: cookieMap,
        sessionid,
        ...(ttwid ? { ttwid } : {}),
      };
    }

    // Silence unused warning; the observer is still useful for logging.
    void sawAuthenticatedSamantha;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }

  throw new Error(
    "Doubao login timed out after 5 minutes. No sessionid cookie was observed — make sure you signed in fully and reached the chat interface.",
  );
}

async function persistCredentials(creds: DoubaoWebCredentials): Promise<void> {
  const dir = zeroApiCredentialsDir();
  await fs.mkdir(dir, { recursive: true });
  const file = doubaoWebCredentialPath();
  const tmp = `${file}.tmp-${process.pid}`;
  await fs.writeFile(tmp, JSON.stringify(creds, null, 2), { mode: 0o600 });
  await fs.rename(tmp, file);
  try {
    await fs.chmod(file, 0o600);
  } catch {
    /* best effort */
  }
}

export async function loadOrLoginDoubaoWeb(): Promise<DoubaoWebCredentials> {
  const existing = await loadDoubaoWebCredentials();
  if (existing) return existing;
  return ensureDoubaoWebLogin();
}
