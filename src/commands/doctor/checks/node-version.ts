import type { CheckResult, DoctorCheck } from "../check-framework.js";

/** Minimum Node.js version required by the project. */
const MIN_NODE_MAJOR = 22;

export class NodeVersionCheck implements DoctorCheck {
  name = "Node.js Version";
  category = "runtime" as const;

  async check(): Promise<CheckResult> {
    const rawVersion = process.version; // e.g. "v22.1.0"
    const major = Number.parseInt(rawVersion.slice(1).split(".")[0], 10);

    if (Number.isNaN(major)) {
      return {
        status: "fail",
        message: `Unable to parse Node.js version: ${rawVersion}`,
      };
    }

    if (major >= MIN_NODE_MAJOR) {
      return {
        status: "pass",
        message: `Node.js ${rawVersion}`,
        detail: `Meets minimum requirement of v${MIN_NODE_MAJOR}+`,
      };
    }

    return {
      status: "warn",
      message: `Node.js ${rawVersion} (minimum v${MIN_NODE_MAJOR} recommended)`,
      detail: `Current major version ${major} is below the recommended ${MIN_NODE_MAJOR}. Some features may not work.`,
      fixHint: `Install Node.js ${MIN_NODE_MAJOR}+ via nvm, fnm, or your package manager`,
    };
  }
}
