import fs from "node:fs/promises";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import {
  launchChromeForLogin,
  stopChrome,
  type RunningChrome,
} from "../../browser/chrome-launcher.js";
import { zeroApiCredentialsDir } from "../../credentials/paths.js";
import {
  qwenCnWebCredentialPath,
  loadQwenCnWebCredentials,
  type QwenCnWebCredentials,
} from "./qwen-cn-auth.js";

/**
 * Interactive login flow for Qwen CN (https://www.qianwen.com, 国内版).
 *
 * Gating signal: we wait until (a) the Alibaba SSO ticket cookie
 * (`tongyi_sso_ticket` or `login_aliyunid_ticket`) is present AND (b) a real
 * authenticated API call to `chat2.qianwen.com/api/v2/chat` comes back with a
 * successful (200) status from the logged-in page. That combination is the
 * authoritative signal — the cookie alone could just be an anonymous visitor
 * marker left over by bot detection.
 */

type LoginResult = QwenCnWebCredentials;
type InFlight = { promise: Promise<LoginResult> };

let inflight: InFlight | null = null;

export function ensureQwenCnWebLogin(): Promise<LoginResult> {
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
    console.info("[zero-api qwen-cn-login] launching Chrome for interactive Qwen CN login...");
    running = await launchChromeForLogin({
      providerId: "qwen-cn-web",
      startUrl: "https://www.qianwen.com/",
    });

    browser = await chromium.connectOverCDP(running.wsUrl);
    context = browser.contexts()[0] ?? (await browser.newContext());

    const existing = context.pages().find((p) => p.url().includes("qianwen.com"));
    if (existing) {
      page = existing;
      await page.bringToFront().catch(() => undefined);
    } else {
      page = context.pages()[0] ?? (await context.newPage());
      try {
        await page.goto("https://www.qianwen.com/", { timeout: 15000 });
      } catch {
        /* ignore; user may navigate manually */
      }
    }

    const userAgent = await page.evaluate(() => navigator.userAgent).catch(() => undefined);
    const captured = await waitForLogin(context, page);

    const persisted: QwenCnWebCredentials = {
      cookies: captured.cookies,
      xsrfToken: captured.xsrfToken,
      ut: captured.ut,
      ...(userAgent ? { userAgent } : {}),
      capturedAt: Date.now(),
    };
    await persistCredentials(persisted);
    console.info("[zero-api qwen-cn-login] captured and persisted Qwen CN Web session.");
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
  xsrfToken: string;
  ut: string;
};

async function waitForLogin(context: BrowserContext, page: Page): Promise<CapturedAuth> {
  const TIMEOUT_MS = 5 * 60 * 1000;
  const POLL_MS = 1000;
  const deadline = Date.now() + TIMEOUT_MS;

  let authOk = false;
  page.on("response", (response) => {
    const url = response.url();
    if (!url.includes("chat2.qianwen.com/api/v2/chat")) return;
    if (response.ok()) {
      authOk = true;
    }
  });

  while (Date.now() < deadline) {
    if (page.isClosed()) {
      throw new Error("Browser window closed before Qwen CN login completed.");
    }

    let cookies: Awaited<ReturnType<BrowserContext["cookies"]>> = [];
    try {
      cookies = await context.cookies([
        "https://www.qianwen.com",
        "https://qianwen.com",
        "https://chat2.qianwen.com",
        "https://login.aliyun.com",
      ]);
    } catch {
      cookies = [];
    }

    const map: Record<string, string> = {};
    for (const c of cookies) {
      map[c.name] = c.value;
    }

    const hasSession = !!(map["tongyi_sso_ticket"] || map["login_aliyunid_ticket"]);

    if (hasSession && authOk) {
      const ut = map["b-user-id"] ?? "";
      let xsrfToken = "";
      try {
        xsrfToken = await page.evaluate(() => {
          const meta = document.querySelector('meta[name="x-xsrf-token"]');
          return meta?.getAttribute("content") || "";
        });
      } catch {
        /* ignore */
      }
      if (!xsrfToken) {
        xsrfToken = map["XSRF-TOKEN"] ?? "";
      }
      return { cookies: map, xsrfToken, ut };
    }

    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error(
    "Qwen CN Web login timed out after 5 minutes. No authenticated API response was observed — make sure you signed in and sent at least one test message.",
  );
}

async function persistCredentials(creds: QwenCnWebCredentials): Promise<void> {
  const dir = zeroApiCredentialsDir();
  await fs.mkdir(dir, { recursive: true });
  const file = qwenCnWebCredentialPath();
  const tmp = `${file}.tmp-${process.pid}`;
  await fs.writeFile(tmp, JSON.stringify(creds, null, 2), { mode: 0o600 });
  await fs.rename(tmp, file);
  try {
    await fs.chmod(file, 0o600);
  } catch {
    /* best effort */
  }
}

export async function loadOrLoginQwenCnWeb(): Promise<QwenCnWebCredentials> {
  const existing = await loadQwenCnWebCredentials();
  if (existing) return existing;
  return ensureQwenCnWebLogin();
}
