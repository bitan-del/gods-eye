import { randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const TOKEN_BYTES = 32;
const TOKEN_FILE_NAME = "gateway-token";
const GODSEYE_DIR = ".godseye";
const TOKEN_FILE_MODE = 0o600;

const DEFAULT_INSECURE_TOKENS = new Set([
  "change-me-to-a-long-random-token",
  "change-me",
  "test",
  "default",
  "",
]);

/** Generate a cryptographically secure gateway token. */
export function generateToken(length: number = TOKEN_BYTES): string {
  return randomBytes(length).toString("hex");
}

/** Get the token file path for the current user. */
export function getTokenFilePath(): string {
  return join(homedir(), GODSEYE_DIR, TOKEN_FILE_NAME);
}

/**
 * Read existing token from file, or generate and persist a new one.
 * On first run the token is written to ~/.godseye/gateway-token (mode 0600)
 * and a notice is printed to stderr.
 */
export async function ensureGatewayToken(): Promise<string> {
  const tokenPath = getTokenFilePath();

  // Try reading an existing token first.
  try {
    const existing = (await readFile(tokenPath, "utf-8")).trim();
    if (existing.length > 0) {
      return existing;
    }
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code !== "ENOENT") {
      throw err;
    }
  }

  // No token on disk -- generate a fresh one, persist, and notify.
  const token = generateToken();
  const dir = join(homedir(), GODSEYE_DIR);
  await mkdir(dir, { recursive: true });
  await writeFile(tokenPath, `${token}\n`, { mode: TOKEN_FILE_MODE });
  // Belt-and-suspenders: ensure mode is correct on platforms that ignore the
  // writeFile mode option (e.g. some NFS mounts).
  await chmod(tokenPath, TOKEN_FILE_MODE);

  process.stderr.write(`[godseye] Generated new gateway token and saved to ${tokenPath}\n`);
  return token;
}

/**
 * Check if the given token is insecure (matches a known default/weak value).
 * Returns a warning message when insecure, null when the token looks ok.
 */
export function checkTokenSecurity(token: string): string | null {
  const trimmed = token.trim();
  if (DEFAULT_INSECURE_TOKENS.has(trimmed)) {
    return `Gateway token is insecure (value: "${trimmed || "(empty)"}"). Run \`godseye gateway token generate\` to create a secure token.`;
  }
  // Warn on very short tokens that aren't in the explicit set.
  if (trimmed.length > 0 && trimmed.length < 16) {
    return "Gateway token is too short (minimum recommended: 16 characters).";
  }
  return null;
}

/**
 * Validate that the gateway is not starting with an insecure token.
 * Throws when the token is insecure and --force was not provided.
 */
export async function validateGatewayToken(
  token: string,
  opts?: { force?: boolean },
): Promise<void> {
  const warning = checkTokenSecurity(token);
  if (!warning) {
    return;
  }
  if (opts?.force) {
    process.stderr.write(`[godseye] WARNING: ${warning}\n`);
    return;
  }
  throw new Error(`${warning} Use --force to override.`);
}
