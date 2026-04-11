import { spawn, type ChildProcess } from "node:child_process";
import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * Minimal self-contained Chrome launcher used by the zero-api plugin to drive
 * a visible browser window for interactive login flows.
 *
 * We intentionally do NOT import anything from extensions/browser so the
 * extension package boundary (see extensions/CLAUDE.md) stays intact. This
 * keeps the surface small: discover a Chrome/Chromium binary, spawn it with a
 * persistent user-data-dir and a random remote debugging port, then wait for
 * the DevTools HTTP endpoint to become reachable so playwright-core can
 * connect over CDP.
 */

export type RunningChrome = {
  proc: ChildProcess;
  cdpPort: number;
  userDataDir: string;
  wsUrl: string;
};

const MACOS_CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
];

const LINUX_CHROME_CANDIDATES = [
  "google-chrome",
  "google-chrome-stable",
  "chromium",
  "chromium-browser",
  "microsoft-edge",
];

function which(bin: string): string | null {
  try {
    const out = execSync(`command -v ${bin}`, { encoding: "utf8" }).trim();
    return out || null;
  } catch {
    return null;
  }
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function findChromeBinary(): Promise<string | null> {
  if (process.platform === "darwin") {
    for (const candidate of MACOS_CHROME_CANDIDATES) {
      if (await pathExists(candidate)) {
        return candidate;
      }
    }
  }
  // Fall back to PATH lookups (works on Linux, also covers macOS installs in
  // non-standard locations).
  for (const candidate of LINUX_CHROME_CANDIDATES) {
    const resolved = which(candidate);
    if (resolved) {
      return resolved;
    }
  }
  return null;
}

export function zeroApiBrowserProfileDir(providerId: string): string {
  return path.join(os.homedir(), ".godseye", "zero-api-browser-profile", providerId);
}

function pickRandomPort(): number {
  // Avoid privileged ports; this range stays well clear of the shim on 64201.
  return 40000 + Math.floor(Math.random() * 20000);
}

async function fetchJson(url: string, timeoutMs: number): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function waitForCdp(port: number, timeoutMs: number): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let lastErr = "unknown";
  while (Date.now() < deadline) {
    const body = (await fetchJson(`http://127.0.0.1:${port}/json/version`, 2000)) as {
      webSocketDebuggerUrl?: string;
    } | null;
    if (body && typeof body.webSocketDebuggerUrl === "string") {
      return body.webSocketDebuggerUrl;
    }
    lastErr = "not ready";
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Chrome CDP endpoint not ready on port ${port}: ${lastErr}`);
}

export type LaunchOptions = {
  providerId: string;
  /** Initial URL to open in the launched browser (optional). */
  startUrl?: string;
  /**
   * When true, launch the window off-screen and minimum-sized so the user
   * never sees Chrome popping up during automated chat turns. Login flows
   * should pass `hidden: false` so the user can actually interact with the
   * sign-in page. Default: false.
   */
  hidden?: boolean;
};

type CdpLockFile = { port: number; pid: number; wsUrl: string; hidden?: boolean };

function cdpLockPath(userDataDir: string): string {
  return path.join(userDataDir, ".zero-api-cdp.json");
}

async function readCdpLock(userDataDir: string): Promise<CdpLockFile | null> {
  try {
    const txt = await fs.readFile(cdpLockPath(userDataDir), "utf8");
    const parsed = JSON.parse(txt) as CdpLockFile;
    if (
      typeof parsed.port === "number" &&
      typeof parsed.pid === "number" &&
      typeof parsed.wsUrl === "string"
    ) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function writeCdpLock(userDataDir: string, lock: CdpLockFile): Promise<void> {
  try {
    await fs.writeFile(cdpLockPath(userDataDir), JSON.stringify(lock), {
      mode: 0o600,
    });
  } catch {
    /* ignore */
  }
}

async function removeCdpLock(userDataDir: string): Promise<void> {
  try {
    await fs.unlink(cdpLockPath(userDataDir));
  } catch {
    /* ignore */
  }
}

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Kill any Chrome processes that are holding the given user-data-dir. We
 * look up the pids via `pgrep -f` with a literal match on the dir path so
 * we don't kill unrelated Chrome windows. Best-effort: ignore failures.
 */
function killChromeByUserDataDir(userDataDir: string): void {
  try {
    const out = execSync(`pgrep -f ${JSON.stringify(`--user-data-dir=${userDataDir}`)}`, {
      encoding: "utf8",
    });
    const pids = out
      .split(/\s+/)
      .map((s) => parseInt(s, 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    for (const pid of pids) {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* no matches or pgrep missing */
  }
}

export async function launchChromeForLogin(options: LaunchOptions): Promise<RunningChrome> {
  const binary = await findChromeBinary();
  if (!binary) {
    throw new Error(
      "Could not locate a Chrome/Chromium binary. Install Google Chrome or set one of the standard system locations.",
    );
  }
  const userDataDir = zeroApiBrowserProfileDir(options.providerId);
  await fs.mkdir(userDataDir, { recursive: true });

  const wantHidden = options.hidden === true;

  // Attempt to reuse a live Chrome from a previous gateway session. This
  // happens when the gateway restarts but macOS Chrome lingers past SIGTERM
  // — the old process still owns the user-data-dir lock, so a fresh spawn
  // would be dispatched to it and exit without opening a new CDP port.
  //
  // Only reuse when the visibility mode matches: a hidden runtime session
  // must not adopt a window the user opened for login (and vice versa),
  // otherwise login would be invisible or runtime would flash a window.
  const existingLock = await readCdpLock(userDataDir);
  const lockHidden = existingLock?.hidden === true;
  if (existingLock && pidAlive(existingLock.pid) && lockHidden === wantHidden) {
    try {
      const body = (await fetchJson(
        `http://127.0.0.1:${existingLock.port}/json/version`,
        1500,
      )) as { webSocketDebuggerUrl?: string } | null;
      if (body && typeof body.webSocketDebuggerUrl === "string") {
        // Reuse the live Chrome. Return a fake ChildProcess handle because
        // we no longer own the original spawn. `stopChrome` will SIGTERM
        // the pid directly.
        const fakeProc = {
          kill: () => undefined,
          pid: existingLock.pid,
        } as unknown as ChildProcess;
        return {
          proc: fakeProc,
          cdpPort: existingLock.port,
          userDataDir,
          wsUrl: body.webSocketDebuggerUrl,
        };
      }
    } catch {
      /* fall through to fresh spawn */
    }
  }

  // Stale lock, mode-mismatched Chrome, or zombie Chrome holding the
  // profile — kill any Chrome that references this exact user-data-dir so
  // the new spawn actually opens a CDP port instead of dispatching to the
  // old instance and exiting.
  if (existingLock || (await pathExists(path.join(userDataDir, "SingletonLock")))) {
    killChromeByUserDataDir(userDataDir);
    await removeCdpLock(userDataDir);
    // Give macOS a moment to release the profile lock file.
    await new Promise((r) => setTimeout(r, 500));
    // Also clear the SingletonLock symlink Chrome writes in the profile
    // directory; if it's stale Chrome will still refuse to start.
    try {
      await fs.unlink(path.join(userDataDir, "SingletonLock"));
    } catch {
      /* ignore */
    }
    try {
      await fs.unlink(path.join(userDataDir, "SingletonCookie"));
    } catch {
      /* ignore */
    }
    try {
      await fs.unlink(path.join(userDataDir, "SingletonSocket"));
    } catch {
      /* ignore */
    }
  }

  const port = pickRandomPort();
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-features=ChromeWhatsNewUI",
  ];
  if (wantHidden) {
    // Runtime mode. We cannot use `--headless=new`: Cloudflare/Turnstile
    // at chatgpt.com (and similar protection at gemini.google.com and
    // chat.z.ai) detects headless Chrome and serves a "Just a moment…"
    // challenge that never resolves, so the authenticated session we need
    // is never reachable.
    //
    // Instead we launch a normal headful Chrome but immediately minimize
    // the window via `Browser.setWindowBounds({windowState:"minimized"})`
    // after connecting over CDP. On macOS that sends the window to the
    // Dock so the user never sees it pop up, while all page scripts keep
    // executing (streaming responses keep ticking because we also disable
    // the default background throttling below).
    args.push(
      "--disable-backgrounding-occluded-windows",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-features=CalculateNativeWinOcclusion",
    );
  } else {
    args.push("--new-window");
  }
  if (options.startUrl) {
    args.push(options.startUrl);
  }

  const proc = spawn(binary, args, {
    stdio: ["ignore", "ignore", "ignore"],
    detached: false,
  });

  proc.on("error", (err) => {
    console.error("[zero-api chrome-launcher] spawn error:", err);
  });

  let wsUrl: string;
  try {
    wsUrl = await waitForCdp(port, 15000);
  } catch (err) {
    try {
      proc.kill("SIGTERM");
    } catch {
      /* ignore */
    }
    throw err;
  }

  if (typeof proc.pid === "number") {
    await writeCdpLock(userDataDir, {
      port,
      pid: proc.pid,
      wsUrl,
      hidden: wantHidden,
    });
  }

  return { proc, cdpPort: port, userDataDir, wsUrl };
}

export function stopChrome(running: RunningChrome): void {
  try {
    running.proc.kill("SIGTERM");
  } catch {
    /* ignore */
  }
}
