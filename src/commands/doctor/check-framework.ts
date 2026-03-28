/**
 * Flutter-style doctor check framework.
 *
 * Each check implements DoctorCheck and returns a CheckResult
 * indicating pass/warn/fail with optional auto-fix support.
 */

export type CheckCategory = "runtime" | "network" | "config" | "auth" | "security";

export interface DoctorCheck {
  name: string;
  category: CheckCategory;
  check(): Promise<CheckResult>;
  /** Optional auto-fix; returns true if the fix succeeded. */
  fix?(): Promise<boolean>;
}

export interface CheckResult {
  status: "pass" | "warn" | "fail";
  message: string;
  /** Extra detail shown with --verbose. */
  detail?: string;
  /** Whether this issue can be auto-fixed. */
  fixable?: boolean;
  /** Human-readable hint, e.g. "Run `godseye config set ...`". */
  fixHint?: string;
}

/** Category display order for Flutter-style grouped output. */
export const CATEGORY_ORDER: CheckCategory[] = ["runtime", "network", "config", "auth", "security"];

/** Human-readable labels for each category. */
export const CATEGORY_LABELS: Record<CheckCategory, string> = {
  runtime: "Runtime Environment",
  network: "Network & Ports",
  config: "Configuration",
  auth: "Authentication",
  security: "Security",
};
