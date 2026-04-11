import fs from "node:fs/promises";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import {
  launchChromeForLogin,
  stopChrome,
  type RunningChrome,
} from "../../browser/chrome-launcher.js";
import { zeroApiCredentialsDir } from "../../credentials/paths.js";
import {
  glmCnWebCredentialPath,
  loadGlmCnWebCredentials,
  type GlmCnWebCredentials,
} from "./glm-cn-auth.js";

/**
 * Interactive login flow for GLM CN (chatglm.cn / 智谱清言).
 *
 * Strong auth signals (any one is sufficient):
 *   (a) the `chatglm_refresh_token` cookie on `.chatglm.cn` — this is the
 *       canonical signal used by the upstream `glm-web-auth.ts` reference
 *       implementation; it is only issued after a successful user login.
 *   (b) an `Authorization: Bearer ...` header observed on a
 *       `/chatglm/*` request from the SPA.
 *
 * Anonymous cookies (cf_clearance, gr_user_id, analytics) are NOT treated
 * as proof of login.
 */

type LoginResult = GlmCnWebCredentials;

type InFlight = { promise: Promise<LoginResult> };
let inflight: InFlight | null = null;

export function ensureGlmCnWebLogin(): Promise<LoginResult> {
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
    console.info(
      "[zero-api glm-cn-web] launching Chrome for interactive ChatGLM CN (chatglm.cn) login...",
    );
    running = await launchChromeForLogin({
      providerId: "glm-cn-web",
      startUrl: "https://chatglm.cn/",
    });

    browser = await chromium.connectOverCDP(running.wsUrl);
    context = browser.contexts()[0] ?? (await browser.newContext());

    const existing = context.pages().find((p) => p.url().includes("chatglm.cn"));
    if (existing) {
      page = existing;
      await page.bringToFront().catch(() => undefined);
    } else {
      page = context.pages()[0] ?? (await context.newPage());
      try {
        await page.goto("https://chatglm.cn/", { timeout: 15_000 });
      } catch {
        /* ignore */
      }
    }

    const userAgent = await page.evaluate(() => navigator.userAgent).catch(() => undefined);

    const captured = await waitForLogin(context, page);

    const persisted: GlmCnWebCredentials = {
      cookies: captured.cookies,
      ...(captured.userToken ? { userToken: captured.userToken } : {}),
      ...(userAgent ? { userAgent } : {}),
      capturedAt: Date.now(),
    };
    await persistCredentials(persisted);
    console.info("[zero-api glm-cn-web] captured and persisted ChatGLM CN session.");
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
  userToken?: string;
};

async function waitForLogin(context: BrowserContext, page: Page): Promise<CapturedCreds> {
  const TIMEOUT_MS = 5 * 60 * 1000;
  const POLL_MS = 1000;
  const deadline = Date.now() + TIMEOUT_MS;

  let capturedBearer: string | undefined;
  page.on("request", (request) => {
    const url = request.url();
    if (!url.includes("chatglm.cn") || !url.includes("/chatglm/")) return;
    const headers = request.headers();
    const auth = headers["authorization"];
    if (auth && auth.startsWith("Bearer ") && !capturedBearer) {
      capturedBearer = auth.slice(7);
    }
  });

  while (Date.now() < deadline) {
    if (page.isClosed()) {
      throw new Error("Browser window closed before ChatGLM CN login completed.");
    }

    let cookieMap: Record<string, string> = {};
    let refreshToken: string | undefined;
    let cookieAccessToken: string | undefined;
    try {
      const cookies = await context.cookies(["https://chatglm.cn"]);
      for (const c of cookies) {
        cookieMap[c.name] = c.value;
        if (c.name === "chatglm_refresh_token" && c.value) refreshToken = c.value;
        if (c.name === "chatglm_token" && c.value) cookieAccessToken = c.value;
      }
    } catch {
      cookieMap = {};
    }

    // chatglm_refresh_token is the canonical logged-in cookie for ChatGLM
    // CN; observing it OR a real captured Authorization: Bearer header
    // means the user finished signing in.
    if (refreshToken || capturedBearer) {
      const token = capturedBearer ?? cookieAccessToken;
      return {
        cookies: cookieMap,
        ...(token ? { userToken: token } : {}),
      };
    }

    await new Promise((r) => setTimeout(r, POLL_MS));
  }

  throw new Error(
    "ChatGLM CN login timed out after 5 minutes. No chatglm_refresh_token cookie or authenticated API request was observed — make sure you signed in fully.",
  );
}

async function persistCredentials(creds: GlmCnWebCredentials): Promise<void> {
  const dir = zeroApiCredentialsDir();
  await fs.mkdir(dir, { recursive: true });
  const file = glmCnWebCredentialPath();
  const tmp = `${file}.tmp-${process.pid}`;
  await fs.writeFile(tmp, JSON.stringify(creds, null, 2), { mode: 0o600 });
  await fs.rename(tmp, file);
  try {
    await fs.chmod(file, 0o600);
  } catch {
    /* best effort */
  }
}

export async function loadOrLoginGlmCnWeb(): Promise<GlmCnWebCredentials> {
  const existing = await loadGlmCnWebCredentials();
  if (existing) return existing;
  return ensureGlmCnWebLogin();
}
