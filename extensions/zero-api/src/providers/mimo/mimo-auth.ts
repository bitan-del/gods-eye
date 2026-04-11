import fs from "node:fs/promises";
import path from "node:path";
import { zeroApiCredentialsDir } from "../../credentials/paths.js";

export const MIMO_WEB_CREDENTIAL_FILE = "mimo-web.json";

export function mimoWebCredentialPath(): string {
  return path.join(zeroApiCredentialsDir(), MIMO_WEB_CREDENTIAL_FILE);
}

export const MIMO_WEB_CREDENTIAL_PATH: string = mimoWebCredentialPath();

/**
 * Credential shape persisted to
 * `~/.godseye/credentials/zero-api/mimo-web.json`.
 *
 * Upstream "xiaomimo-web-auth.ts" resolves once a Bearer token has been
 * observed on a request to `xiaomimimo.com` (or a `token`/`session`/`auth`
 * cookie with enough other cookies set). We mirror that: a successful login
 * requires at least a userToken (Bearer) — cookies alone are never enough.
 */
export type MimoWebCredentials = {
  /** Cookie jar: { name: value } pairs captured from aistudio.xiaomimimo.com. */
  cookies: Record<string, string>;
  /** Bearer/session token captured from an authenticated request. */
  userToken?: string;
  /** Optional stored user-agent so server logs line up with the capture. */
  userAgent?: string;
  /** Timestamp (ms) of capture, purely informational. */
  capturedAt?: number;
};

export async function loadMimoWebCredentials(): Promise<MimoWebCredentials | undefined> {
  const filePath = mimoWebCredentialPath();
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
  const record = parsed as Partial<MimoWebCredentials>;
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
