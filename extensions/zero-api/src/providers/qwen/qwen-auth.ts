import fs from "node:fs/promises";
import path from "node:path";
import { zeroApiCredentialsDir } from "../../credentials/paths.js";

export const QWEN_WEB_CREDENTIAL_FILE = "qwen-web.json";

export function qwenWebCredentialPath(): string {
  return path.join(zeroApiCredentialsDir(), QWEN_WEB_CREDENTIAL_FILE);
}

/**
 * Credential shape persisted to
 * `~/.godseye/credentials/zero-api/qwen-web.json`. Written by the auto-login
 * flow in `qwen-login.ts`.
 *
 * Qwen International (chat.qwen.ai) issues a Bearer token (`token` cookie +
 * `Authorization: Bearer ...` on every `/api/v2/*` call). The token is the
 * authoritative auth signal — cookies alone are not enough to consider the
 * session live because chat.qwen.ai drops multiple analytics/bot-detection
 * cookies before sign-in.
 */
export type QwenWebCredentials = {
  /** Cookie jar from chat.qwen.ai. */
  cookies: Record<string, string>;
  /** Bearer token observed on an authenticated `/api/v2/*` request. */
  bearer?: string;
  /** Optional stored user-agent so server logs line up with the capture. */
  userAgent?: string;
  /** Timestamp (ms) of capture, purely informational. */
  capturedAt?: number;
};

export async function loadQwenWebCredentials(): Promise<QwenWebCredentials | undefined> {
  const filePath = qwenWebCredentialPath();
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
  const record = parsed as Partial<QwenWebCredentials>;
  const cookies =
    record.cookies && typeof record.cookies === "object"
      ? (record.cookies as Record<string, string>)
      : {};
  const hasBearer = typeof record.bearer === "string" && record.bearer.length > 0;
  if (!hasBearer) {
    return undefined;
  }
  return {
    cookies,
    bearer: record.bearer,
    ...(typeof record.userAgent === "string" ? { userAgent: record.userAgent } : {}),
    ...(typeof record.capturedAt === "number" ? { capturedAt: record.capturedAt } : {}),
  };
}

export function formatQwenCookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}
