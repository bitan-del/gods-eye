import fs from "node:fs/promises";
import path from "node:path";
import { zeroApiCredentialsDir } from "../../credentials/paths.js";

/**
 * GLM CN (chatglm.cn / Zhipu 智谱清言) browser-session credentials.
 *
 * Stored at `~/.godseye/credentials/zero-api/glm-cn-web.json`.
 */
export const GLM_CN_WEB_CREDENTIAL_FILE = "glm-cn-web.json";

export function glmCnWebCredentialPath(): string {
  return path.join(zeroApiCredentialsDir(), GLM_CN_WEB_CREDENTIAL_FILE);
}

export const GLM_CN_WEB_CREDENTIAL_PATH: string = glmCnWebCredentialPath();

export type GlmCnWebCredentials = {
  /** Cookie jar: { name: value } pairs captured from chatglm.cn. */
  cookies: Record<string, string>;
  /**
   * Optional bearer `chatglm_token` captured from the cookie jar or via a
   * `/chatglm/user-api/user/refresh` round-trip.
   */
  userToken?: string;
  userAgent?: string;
  capturedAt?: number;
};

export async function loadGlmCnWebCredentials(): Promise<GlmCnWebCredentials | undefined> {
  const filePath = glmCnWebCredentialPath();
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
  const record = parsed as Partial<GlmCnWebCredentials>;
  const cookies =
    record.cookies && typeof record.cookies === "object"
      ? (record.cookies as Record<string, string>)
      : {};
  const hasCookie = Object.keys(cookies).length > 0;
  const hasToken = typeof record.userToken === "string" && record.userToken.length > 0;
  if (!hasCookie && !hasToken) return undefined;
  return {
    cookies,
    ...(hasToken ? { userToken: record.userToken } : {}),
    ...(typeof record.userAgent === "string" ? { userAgent: record.userAgent } : {}),
    ...(typeof record.capturedAt === "number" ? { capturedAt: record.capturedAt } : {}),
  };
}

export function formatCookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}
