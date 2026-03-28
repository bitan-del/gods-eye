import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { CheckResult, DoctorCheck } from "../check-framework.js";

/** Well-known insecure default token values that must be replaced. */
const INSECURE_DEFAULTS = new Set(["change-me", "changeme", "token", "default", ""]);

const CONFIG_FILE = path.join(os.homedir(), ".godseye", "config.json");

/**
 * Safely read the gateway auth token from the config file.
 * Returns undefined if the file or key is missing.
 */
async function readGatewayToken(): Promise<string | undefined> {
  let raw: string;
  try {
    raw = await fs.readFile(CONFIG_FILE, "utf8");
  } catch {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const gateway = parsed.gateway as Record<string, unknown> | undefined;
    const auth = gateway?.auth as Record<string, unknown> | undefined;
    return typeof auth?.token === "string" ? auth.token : undefined;
  } catch {
    return undefined;
  }
}

export class GatewayTokenCheck implements DoctorCheck {
  name = "Gateway Token";
  category = "auth" as const;

  async check(): Promise<CheckResult> {
    const token = await readGatewayToken();

    if (token === undefined) {
      return {
        status: "warn",
        message: "No gateway token configured",
        detail: "gateway.auth.token is not set in the config file",
        fixHint: 'Run `godseye config set gateway.auth.token "<your-token>"`',
      };
    }

    if (INSECURE_DEFAULTS.has(token.toLowerCase().trim())) {
      return {
        status: "fail",
        message: "Gateway token is set to an insecure default value",
        detail: "Using a well-known default token exposes your gateway to unauthorized access.",
        fixable: true,
        fixHint: 'Run `godseye config set gateway.auth.token "<secure-token>"`',
      };
    }

    return {
      status: "pass",
      message: "Gateway token is configured",
      // Never reveal the actual token value in output.
      detail: `Token length: ${token.length} characters`,
    };
  }
}
