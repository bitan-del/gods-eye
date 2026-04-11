import os from "node:os";
import path from "node:path";

/**
 * Root directory for zero-api credential files such as
 * `~/.godseye/credentials/zero-api/deepseek-web.json`.
 *
 * Each browser-session provider stores its captured cookies/bearer here.
 */
export function zeroApiCredentialsDir(): string {
  return path.join(os.homedir(), ".godseye", "credentials", "zero-api");
}
