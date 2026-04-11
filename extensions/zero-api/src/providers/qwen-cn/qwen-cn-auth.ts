import fs from "node:fs/promises";
import path from "node:path";
import { zeroApiCredentialsDir } from "../../credentials/paths.js";

export const QWEN_CN_WEB_CREDENTIAL_FILE = "qwen-cn-web.json";

export function qwenCnWebCredentialPath(): string {
  return path.join(zeroApiCredentialsDir(), QWEN_CN_WEB_CREDENTIAL_FILE);
}

/**
 * Credential shape persisted to
 * `~/.godseye/credentials/zero-api/qwen-cn-web.json`. Written by the
 * auto-login flow in `qwen-cn-login.ts`.
 *
 * Qwen CN (chat2.qianwen.com) authenticates via the Alibaba SSO cookie
 * (`tongyi_sso_ticket` or `login_aliyunid_ticket`) plus an `XSRF-TOKEN`
 * cookie and a `b-user-id` (`ut`) cookie used to form every API request.
 * The authoritative signal for "logged in" is a successful authenticated
 * POST to `chat2.qianwen.com/api/v2/chat` observed inside the browser.
 */
export type QwenCnWebCredentials = {
  /** Full cookie jar from .qianwen.com (needed for browser re-hydration). */
  cookies: Record<string, string>;
  /** x-xsrf-token value extracted from either a meta tag or the XSRF-TOKEN cookie. */
  xsrfToken: string;
  /** b-user-id cookie value, used as `ut` query parameter. */
  ut: string;
  /** Optional stored user-agent so server logs line up with the capture. */
  userAgent?: string;
  /** Timestamp (ms) of capture, purely informational. */
  capturedAt?: number;
};

export async function loadQwenCnWebCredentials(): Promise<QwenCnWebCredentials | undefined> {
  const filePath = qwenCnWebCredentialPath();
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!parsed || typeof parsed !== "object") {
    return undefined;
  }
  const record = parsed as Partial<QwenCnWebCredentials>;
  const cookies =
    record.cookies && typeof record.cookies === "object"
      ? (record.cookies as Record<string, string>)
      : {};
  const hasSession =
    typeof cookies["tongyi_sso_ticket"] === "string" ||
    typeof cookies["login_aliyunid_ticket"] === "string";
  if (!hasSession) {
    return undefined;
  }
  return {
    cookies,
    xsrfToken: typeof record.xsrfToken === "string" ? record.xsrfToken : "",
    ut: typeof record.ut === "string" ? record.ut : "",
    ...(typeof record.userAgent === "string" ? { userAgent: record.userAgent } : {}),
    ...(typeof record.capturedAt === "number" ? { capturedAt: record.capturedAt } : {}),
  };
}

export function formatQwenCnCookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}
