/** Task completion verification -- pure functions, no external deps. */

export interface TaskEvidence {
  toolResults: Array<{
    tool: string;
    success: boolean;
    hasOutput: boolean;
    errorMessage?: string;
  }>;
  originalObjective: string;
  agentClaimedComplete: boolean;
  totalTurns: number;
  lastTurnHadAction: boolean;
}

export interface VerificationResult {
  verified: boolean;
  confidence: number; // 0.0-1.0
  issues: VerificationIssue[];
  recommendation: "accept" | "retry" | "escalate";
}

export interface VerificationIssue {
  severity: "info" | "warn" | "critical";
  code: string;
  message: string;
}

// Patterns indicating errors in tool output: [regex, label].
const ERROR_PATTERNS: Array<[RegExp, string]> = [
  [/\bError:/i, "error-message"],
  [/\bFAILED\b/, "failed-marker"],
  [/\bPermission denied\b/i, "permission-denied"],
  [/\bnot found\b/i, "not-found"],
  [/\btimeout\b/i, "timeout"],
  [/\bTraceback\b/, "python-traceback"],
  [/^\s+at\s+.+\(.+:\d+:\d+\)/m, "js-stack-trace"],
  [/\b[45]\d{2}\b/, "http-error-code"],
  [/\bundefined\b/, "undefined-value"],
  [/\bnull\b/, "null-value"],
  [/\bTODO\b/, "todo-marker"],
  [/\bFIXME\b/, "fixme-marker"],
  [/\bnot implemented\b/i, "not-implemented"],
  [/\bENOENT\b/, "enoent"],
  [/\bEACCES\b/, "eacces"],
  [/\bsegmentation fault\b/i, "segfault"],
];

// Map objective verbs to expected tool name fragments: [verbs[], toolFragments[]].
const ACTION_TOOL_MAP: Array<[string[], string[]]> = [
  [
    ["write", "create", "add", "generate"],
    ["write", "create", "file", "save"],
  ],
  [
    ["read", "check", "inspect", "view"],
    ["read", "get", "list", "view", "cat"],
  ],
  [
    ["delete", "remove", "clean"],
    ["delete", "remove", "rm", "clean"],
  ],
  [
    ["run", "execute", "start", "launch"],
    ["run", "exec", "command", "shell", "bash"],
  ],
  [
    ["install", "setup", "configure"],
    ["install", "setup", "config", "npm", "pip"],
  ],
  [
    ["test", "verify", "validate"],
    ["test", "assert", "check", "verify"],
  ],
  [
    ["search", "find", "locate"],
    ["search", "find", "grep", "glob"],
  ],
  [
    ["edit", "update", "modify", "fix"],
    ["edit", "write", "patch", "update", "replace"],
  ],
];

/** Detect common failure patterns in tool outputs. */
export function detectFailurePatterns(output: string): {
  hasError: boolean;
  patterns: string[];
} {
  const matched: string[] = [];
  for (const [pattern, label] of ERROR_PATTERNS) {
    if (pattern.test(output)) {
      matched.push(label);
    }
  }
  return { hasError: matched.length > 0, patterns: matched };
}

/** Check if the last tool results indicate success or failure. */
export function checkToolResults(results: TaskEvidence["toolResults"]): {
  allSucceeded: boolean;
  failureCount: number;
  errorPatterns: string[];
} {
  let failureCount = 0;
  const errorPatterns: string[] = [];

  for (const r of results) {
    if (!r.success) {
      failureCount += 1;
      if (r.errorMessage) {
        const { patterns } = detectFailurePatterns(r.errorMessage);
        errorPatterns.push(...patterns);
      }
    }
  }

  return {
    allSucceeded: failureCount === 0 && results.length > 0,
    failureCount,
    errorPatterns: [...new Set(errorPatterns)],
  };
}

/** Check if the agent's actions relate to the original objective. */
export function checkObjectiveAlignment(
  objective: string,
  toolsUsed: string[],
): { aligned: boolean; score: number } {
  if (!objective || toolsUsed.length === 0) {
    return { aligned: false, score: 0 };
  }

  const lowerObjective = objective.toLowerCase();
  const lowerTools = toolsUsed.map((t) => t.toLowerCase());
  let matchedMappings = 0;
  let totalMappings = 0;

  for (const [verbs, fragments] of ACTION_TOOL_MAP) {
    if (!verbs.some((v) => lowerObjective.includes(v))) {
      continue;
    }
    totalMappings += 1;
    if (lowerTools.some((t) => fragments.some((f) => t.includes(f)))) {
      matchedMappings += 1;
    }
  }

  if (totalMappings === 0) {
    // No recognized verbs -- assume aligned (cannot disprove).
    return { aligned: true, score: 0.5 };
  }

  const score = matchedMappings / totalMappings;
  return { aligned: score >= 0.5, score };
}

/** Verify that a task was actually completed based on evidence. */
export function verifyCompletion(evidence: TaskEvidence): VerificationResult {
  const issues: VerificationIssue[] = [];
  let confidence = 1.0;

  const { toolResults, originalObjective, agentClaimedComplete, totalTurns, lastTurnHadAction } =
    evidence;
  const push = (
    severity: VerificationIssue["severity"],
    code: string,
    message: string,
    penalty: number,
  ) => {
    issues.push({ severity, code, message });
    confidence -= penalty;
  };

  // No tool calls but agent claimed complete.
  if (toolResults.length === 0 && agentClaimedComplete) {
    push("critical", "NO_ACTIONS", "Agent claimed task complete but made no tool calls.", 0.6);
  }

  // Tool result validation.
  const toolCheck = checkToolResults(toolResults);
  if (toolCheck.failureCount > 0) {
    const allFailed = toolCheck.failureCount === toolResults.length;
    push(
      allFailed ? "critical" : "warn",
      "TOOL_FAILURES",
      `${toolCheck.failureCount}/${toolResults.length} tool calls failed.`,
      allFailed ? 0.5 : 0.2,
    );
  }
  if (toolCheck.errorPatterns.length > 0) {
    push(
      "warn",
      "ERROR_PATTERNS",
      `Error patterns detected: ${toolCheck.errorPatterns.join(", ")}.`,
      0.1,
    );
  }

  // Tools with no output (possibly truncated/empty).
  const emptyOutputCount = toolResults.filter((r) => r.success && !r.hasOutput).length;
  if (emptyOutputCount > 0) {
    push("warn", "EMPTY_OUTPUT", `${emptyOutputCount} tool call(s) returned no output.`, 0.1);
  }

  // Objective alignment.
  const alignment = checkObjectiveAlignment(
    originalObjective,
    toolResults.map((r) => r.tool),
  );
  if (!alignment.aligned) {
    push(
      "warn",
      "OBJECTIVE_MISMATCH",
      "Tools used do not appear to match the stated objective.",
      0.2,
    );
  }

  // Last turn had no action (agent may have given up).
  if (!lastTurnHadAction && totalTurns > 1) {
    push("info", "IDLE_LAST_TURN", "The final turn had no tool action.", 0.05);
  }

  confidence = Math.max(0, Math.min(1, confidence));

  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const warnCount = issues.filter((i) => i.severity === "warn").length;
  const recommendation: VerificationResult["recommendation"] =
    criticalCount >= 2
      ? "escalate"
      : criticalCount === 1 || (warnCount >= 2 && confidence < 0.5)
        ? "retry"
        : "accept";

  return {
    verified: criticalCount === 0 && confidence >= 0.5,
    confidence: Math.round(confidence * 100) / 100,
    issues,
    recommendation,
  };
}
