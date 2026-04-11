import fs from "node:fs/promises";
import path from "node:path";
import { zeroApiCredentialsDir } from "../../credentials/paths.js";

export const DEEPSEEK_WEB_CREDENTIAL_FILE = "deepseek-web.json";

export function deepSeekWebCredentialPath(): string {
  return path.join(zeroApiCredentialsDir(), DEEPSEEK_WEB_CREDENTIAL_FILE);
}

// Backwards-compatible alias; keeps a constant name close to the upstream
// codebase while also supporting on-disk directory relocation via homedir().
export const DEEPSEEK_WEB_CREDENTIAL_PATH: string = deepSeekWebCredentialPath();

/**
 * Credential shape persisted to
 * `~/.godseye/credentials/zero-api/deepseek-web.json`. Written either by the
 * auto-login flow in `deepseek-login.ts` or, historically, by the
 * `login-deepseek.mjs` manual helper. At least one cookie (or a userToken) is
 * required for the credentials to be considered present.
 */
export type DeepSeekWebCredentials = {
  /** Cookie jar: { name: value } pairs captured from chat.deepseek.com. */
  cookies: Record<string, string>;
  /** Optional bearer token surfaced in some login flows. */
  userToken?: string;
  /** Optional stored user-agent so server logs line up with the capture. */
  userAgent?: string;
  /** Timestamp (ms) of capture, purely informational. */
  capturedAt?: number;
};

/**
 * Load captured DeepSeek Web credentials from
 * `~/.godseye/credentials/zero-api/deepseek-web.json`.
 *
 * Returns `undefined` when the file does not exist or is unreadable so that
 * the plugin can stay silently invisible until the user runs the login helper.
 */
export async function loadDeepSeekWebCredentials(): Promise<DeepSeekWebCredentials | undefined> {
  const filePath = deepSeekWebCredentialPath();
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
  const record = parsed as Partial<DeepSeekWebCredentials>;
  const cookies =
    record.cookies && typeof record.cookies === "object"
      ? (record.cookies as Record<string, string>)
      : {};
  const hasCookie = Object.keys(cookies).length > 0;
  const hasToken = typeof record.userToken === "string" && record.userToken.length > 0;
  if (!hasCookie && !hasToken) {
    return undefined;
  }
  return {
    cookies,
    ...(hasToken ? { userToken: record.userToken } : {}),
    ...(typeof record.userAgent === "string" ? { userAgent: record.userAgent } : {}),
    ...(typeof record.capturedAt === "number" ? { capturedAt: record.capturedAt } : {}),
  };
}

/** Serialize the cookie map into a `Cookie:` header value. */
export function formatCookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}
