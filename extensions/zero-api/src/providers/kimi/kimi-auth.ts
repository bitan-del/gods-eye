import fs from "node:fs/promises";
import path from "node:path";
import { zeroApiCredentialsDir } from "../../credentials/paths.js";

export const KIMI_WEB_CREDENTIAL_FILE = "kimi-web.json";

export function kimiWebCredentialPath(): string {
  return path.join(zeroApiCredentialsDir(), KIMI_WEB_CREDENTIAL_FILE);
}

/**
 * Credential shape persisted to
 * `~/.godseye/credentials/zero-api/kimi-web.json`. Written by the auto-login
 * flow in `kimi-login.ts`.
 *
 * Kimi (www.kimi.com) authenticates via:
 *   - an `access_token` stored in localStorage (the authoritative session
 *     signal the SPA uses on every `/apiv2/*` call), and
 *   - a `kimi-auth` cookie as a fallback.
 * At least one of those must be present for the credentials to be useful.
 */
export type KimiWebCredentials = {
  /** Cookie jar captured from kimi.com. */
  cookies: Record<string, string>;
  /** Access token from localStorage (preferred auth bearer). */
  accessToken?: string;
  /** Refresh token from localStorage, if present. */
  refreshToken?: string;
  /** Optional stored user-agent so server logs line up with the capture. */
  userAgent?: string;
  /** Timestamp (ms) of capture, purely informational. */
  capturedAt?: number;
};

export async function loadKimiWebCredentials(): Promise<KimiWebCredentials | undefined> {
  const filePath = kimiWebCredentialPath();
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
  const record = parsed as Partial<KimiWebCredentials>;
  const cookies =
    record.cookies && typeof record.cookies === "object"
      ? (record.cookies as Record<string, string>)
      : {};
  const hasAccess = typeof record.accessToken === "string" && record.accessToken.length > 0;
  const hasKimiAuth = typeof cookies["kimi-auth"] === "string" && cookies["kimi-auth"].length > 0;
  if (!hasAccess && !hasKimiAuth) {
    return undefined;
  }
  return {
    cookies,
    ...(hasAccess ? { accessToken: record.accessToken } : {}),
    ...(typeof record.refreshToken === "string" ? { refreshToken: record.refreshToken } : {}),
    ...(typeof record.userAgent === "string" ? { userAgent: record.userAgent } : {}),
    ...(typeof record.capturedAt === "number" ? { capturedAt: record.capturedAt } : {}),
  };
}

export function formatKimiCookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}
