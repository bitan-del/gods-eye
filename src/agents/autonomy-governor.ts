// Progressive autonomy governor — configurable autonomy levels with trust accumulation.
// Pure functions, immutable config pattern (always returns new objects).

export type AutonomyLevel = "supervised" | "semi-autonomous" | "autonomous";

export type ToolRisk = "safe" | "moderate" | "dangerous" | "critical";

export interface AutonomyConfig {
  level: AutonomyLevel;
  /** 0-100, accumulates over successful sessions. */
  trustScore: number;
  /** Trust score threshold to auto-upgrade level (default 75). */
  autoEscalateThreshold: number;
  /** Drop level on critical failure (default true). */
  autoDeescalateOnFailure: boolean;
}

export interface AutonomyDecision {
  action: "allow" | "pause" | "block";
  reason: string;
  requiresApproval: boolean;
  riskLevel: ToolRisk;
}

export interface TrustUpdate {
  newScore: number;
  levelChanged: boolean;
  newLevel?: AutonomyLevel;
  reason: string;
}

export const DEFAULT_AUTONOMY_CONFIG: AutonomyConfig = {
  level: "supervised",
  trustScore: 0,
  autoEscalateThreshold: 75,
  autoDeescalateOnFailure: true,
};

// -- Tool risk classification patterns --

const SAFE_PATTERNS = [
  "file_read",
  "list_files",
  "search",
  "status",
  "web_search",
  "get_",
  "read_",
  "list_",
  "show_",
  "describe_",
  "view_",
  "inspect_",
  "query_",
  "fetch_",
  "count_",
  "check_",
] as const;

const MODERATE_PATTERNS = [
  "file_write",
  "file_edit",
  "git_commit",
  "send_message",
  "write_",
  "edit_",
  "update_",
  "create_",
  "add_",
  "set_",
  "move_",
  "rename_",
  "copy_",
  "git_",
] as const;

const DANGEROUS_PATTERNS = [
  "bash",
  "shell",
  "exec",
  "run_command",
  "spawn",
  "npm_install",
  "pip_install",
  "apt_install",
  "install_",
  "run_",
  "execute_",
] as const;

const CRITICAL_PATTERNS = [
  "config_set",
  "gateway_restart",
  "cron_create",
  "cron",
  "delete_",
  "rm",
  "sudo",
  "chmod",
  "chown",
  "gateway",
  "destroy_",
  "drop_",
  "purge_",
  "format_",
  "restart_",
  "shutdown_",
  "reboot_",
] as const;

function matchesPatterns(toolName: string, patterns: readonly string[]): boolean {
  const normalized = toolName.toLowerCase();
  return patterns.some((pattern) => {
    // Exact match or prefix match (for patterns ending with _)
    if (pattern.endsWith("_")) {
      return normalized.startsWith(pattern);
    }
    return normalized === pattern;
  });
}

/** Classify the risk level of a tool. */
export function classifyToolRisk(toolName: string, _args?: Record<string, unknown>): ToolRisk {
  const normalized = toolName.toLowerCase();

  // Check from most restrictive to least — first match wins.
  if (matchesPatterns(normalized, CRITICAL_PATTERNS)) {
    return "critical";
  }
  if (matchesPatterns(normalized, DANGEROUS_PATTERNS)) {
    return "dangerous";
  }
  if (matchesPatterns(normalized, MODERATE_PATTERNS)) {
    return "moderate";
  }
  if (matchesPatterns(normalized, SAFE_PATTERNS)) {
    return "safe";
  }

  // Unknown tools default to moderate (cautious but not blocking).
  return "moderate";
}

// -- Level-to-risk action matrix --

type RiskActionMap = Record<ToolRisk, "allow" | "pause" | "block">;

const LEVEL_ACTIONS: Record<AutonomyLevel, RiskActionMap> = {
  supervised: { safe: "allow", moderate: "pause", dangerous: "block", critical: "block" },
  "semi-autonomous": { safe: "allow", moderate: "allow", dangerous: "pause", critical: "block" },
  autonomous: { safe: "allow", moderate: "allow", dangerous: "allow", critical: "pause" },
};

/** Decide whether a tool call should proceed given the current autonomy level. */
export function evaluateToolCall(
  toolName: string,
  args: Record<string, unknown>,
  config: AutonomyConfig,
): AutonomyDecision {
  const riskLevel = classifyToolRisk(toolName, args);
  const action = LEVEL_ACTIONS[config.level][riskLevel];

  const requiresApproval = action === "pause";

  const reasonParts: string[] = [];
  if (action === "allow") {
    reasonParts.push(`Tool "${toolName}" (${riskLevel}) is allowed at ${config.level} level`);
  } else if (action === "pause") {
    reasonParts.push(
      `Tool "${toolName}" (${riskLevel}) requires approval at ${config.level} level`,
    );
  } else {
    reasonParts.push(`Tool "${toolName}" (${riskLevel}) is blocked at ${config.level} level`);
  }

  return { action, reason: reasonParts.join(". "), requiresApproval, riskLevel };
}

// -- Trust accumulation --

const TRUST_INCREMENT_SUCCESS = 2;
const TRUST_DECREMENT_FAILURE = 5;
const TRUST_DECREMENT_CRITICAL = 20;
const TRUST_MAX = 100;
const TRUST_MIN = 0;

// Thresholds for auto-escalation between levels.
const ESCALATION_THRESHOLDS: Record<AutonomyLevel, number | undefined> = {
  supervised: 50,
  "semi-autonomous": 75,
  autonomous: undefined, // Already at max level.
};

const LEVEL_ORDER: AutonomyLevel[] = ["supervised", "semi-autonomous", "autonomous"];

function nextLevel(current: AutonomyLevel): AutonomyLevel | undefined {
  const idx = LEVEL_ORDER.indexOf(current);
  return idx >= 0 && idx < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[idx + 1] : undefined;
}

function prevLevel(current: AutonomyLevel): AutonomyLevel | undefined {
  const idx = LEVEL_ORDER.indexOf(current);
  return idx > 0 ? LEVEL_ORDER[idx - 1] : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Update trust score after a completed action. Returns a new config snapshot. */
export function updateTrust(
  config: AutonomyConfig,
  outcome: "success" | "failure" | "critical_failure",
): TrustUpdate {
  let delta: number;
  if (outcome === "success") {
    delta = TRUST_INCREMENT_SUCCESS;
  } else if (outcome === "failure") {
    delta = -TRUST_DECREMENT_FAILURE;
  } else {
    delta = -TRUST_DECREMENT_CRITICAL;
  }

  const newScore = clamp(config.trustScore + delta, TRUST_MIN, TRUST_MAX);
  let newLevel: AutonomyLevel | undefined;
  let levelChanged = false;

  // Auto-deescalate on critical failure.
  if (outcome === "critical_failure" && config.autoDeescalateOnFailure) {
    const lower = prevLevel(config.level);
    if (lower) {
      newLevel = lower;
      levelChanged = true;
    }
  }

  // Auto-escalate when trust score exceeds the threshold for the current level.
  if (!levelChanged && outcome === "success") {
    const threshold = ESCALATION_THRESHOLDS[config.level];
    if (threshold !== undefined && newScore >= threshold) {
      const higher = nextLevel(config.level);
      if (higher) {
        newLevel = higher;
        levelChanged = true;
      }
    }
  }

  const reason = buildTrustReason(outcome, config.trustScore, newScore, levelChanged, newLevel);

  return { newScore, levelChanged, ...(newLevel ? { newLevel } : {}), reason };
}

function buildTrustReason(
  outcome: string,
  oldScore: number,
  newScore: number,
  levelChanged: boolean,
  newLevel?: AutonomyLevel,
): string {
  const parts = [`Trust ${oldScore} -> ${newScore} (${outcome})`];
  if (levelChanged && newLevel) {
    parts.push(`Level changed to ${newLevel}`);
  }
  return parts.join(". ");
}

/** Get a human-readable description of the current autonomy state. */
export function describeAutonomy(config: AutonomyConfig): string {
  const lines: string[] = [
    `Autonomy level: ${config.level}`,
    `Trust score: ${config.trustScore}/100`,
  ];

  const threshold = ESCALATION_THRESHOLDS[config.level];
  if (threshold !== undefined) {
    const next = nextLevel(config.level);
    if (next) {
      const remaining = Math.max(0, threshold - config.trustScore);
      lines.push(
        remaining > 0
          ? `${remaining} points until auto-escalation to ${next}`
          : `Eligible for escalation to ${next}`,
      );
    }
  } else {
    lines.push("Maximum autonomy level reached");
  }

  if (config.autoDeescalateOnFailure) {
    lines.push("Auto-deescalation on critical failure: enabled");
  }

  return lines.join("\n");
}
