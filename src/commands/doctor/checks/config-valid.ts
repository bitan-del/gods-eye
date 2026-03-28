import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { CheckResult, DoctorCheck } from "../check-framework.js";

/** Default config file location. */
const CONFIG_DIR = path.join(os.homedir(), ".godseye");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export class ConfigValidCheck implements DoctorCheck {
  name = "Configuration File";
  category = "config" as const;

  async check(): Promise<CheckResult> {
    let raw: string;
    try {
      raw = await fs.readFile(CONFIG_FILE, "utf8");
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        return {
          status: "warn",
          message: "No config file found",
          detail: `Expected at ${CONFIG_FILE}`,
          fixHint: "Run `godseye config set gateway.mode local` to create a default config",
          fixable: false,
        };
      }
      return {
        status: "fail",
        message: `Cannot read config file: ${(err as Error).message}`,
        detail: `Path: ${CONFIG_FILE}`,
      };
    }

    // Validate JSON syntax.
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return {
          status: "fail",
          message: "Config file is not a JSON object",
          detail: `Found ${Array.isArray(parsed) ? "array" : typeof parsed} at top level`,
          fixHint: "Replace config contents with a valid JSON object `{}`",
        };
      }
    } catch {
      return {
        status: "fail",
        message: "Config file contains invalid JSON",
        detail: `Path: ${CONFIG_FILE}`,
        fixHint: "Fix JSON syntax errors in the config file, or delete and recreate it",
      };
    }

    return {
      status: "pass",
      message: "Config file is valid JSON",
      detail: CONFIG_FILE,
    };
  }
}
