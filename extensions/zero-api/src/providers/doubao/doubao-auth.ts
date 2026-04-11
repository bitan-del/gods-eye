import fs from "node:fs/promises";
import path from "node:path";
import { zeroApiCredentialsDir } from "../../credentials/paths.js";

/**
 * Doubao (www.doubao.com / ByteDance) browser-session credentials.
 *
 * Stored at `~/.godseye/credentials/zero-api/doubao-web.json`.
 *
 * The canonical authenticated signal is the `sessionid` cookie on
 * `.doubao.com`; `ttwid` and the cookie jar are additional material
 * passed to the samantha chat API.
 */
export const DOUBAO_WEB_CREDENTIAL_FILE = "doubao-web.json";

export function doubaoWebCredentialPath(): string {
  return path.join(zeroApiCredentialsDir(), DOUBAO_WEB_CREDENTIAL_FILE);
}

export const DOUBAO_WEB_CREDENTIAL_PATH: string = doubaoWebCredentialPath();

export type DoubaoWebCredentials = {
  /** Cookie jar: { name: value } pairs captured from www.doubao.com. */
  cookies: Record<string, string>;
  /** Session ID cookie — the actual logged-in signal. */
  sessionid: string;
  /** Optional bot-detection ttwid cookie. */
  ttwid?: string;
  userAgent?: string;
  capturedAt?: number;
};

export async function loadDoubaoWebCredentials(): Promise<DoubaoWebCredentials | undefined> {
  const filePath = doubaoWebCredentialPath();
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
  if (!parsed || typeof parsed !== "object") return undefined;
  const record = parsed as Partial<DoubaoWebCredentials>;
  const cookies =
    record.cookies && typeof record.cookies === "object"
      ? (record.cookies as Record<string, string>)
      : {};
  const sessionid =
    typeof record.sessionid === "string" && record.sessionid.length > 0
      ? record.sessionid
      : typeof cookies["sessionid"] === "string"
        ? cookies["sessionid"]
        : "";
  if (!sessionid) return undefined;
  return {
    cookies,
    sessionid,
    ...(typeof record.ttwid === "string" ? { ttwid: record.ttwid } : {}),
    ...(typeof record.userAgent === "string" ? { userAgent: record.userAgent } : {}),
    ...(typeof record.capturedAt === "number" ? { capturedAt: record.capturedAt } : {}),
  };
}

export function formatCookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}
