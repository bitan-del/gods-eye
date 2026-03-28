/**
 * Enhanced loop detection with objective drift analysis and 3-state circuit breaker.
 * Designed as a v2 alongside the existing tool-loop-detection.ts system.
 */

// --- Types ---

/** Three-state circuit breaker: closed (normal), degraded (warning), open (blocked). */
export type CircuitState = "closed" | "degraded" | "open";

export interface CircuitBreaker {
  state: CircuitState;
  failureCount: number;
  degradedSince?: number;
  openSince?: number;
  cooldownMs: number;
}

export interface ObjectiveDriftResult {
  drifted: boolean;
  similarity: number;
  originalKeywords: string[];
  currentKeywords: string[];
  reason?: string;
}

export interface LoopDetectionV2Config {
  enabled: boolean;
  warningThreshold: number;
  criticalThreshold: number;
  maxConsecutiveReasoningTurns: number;
  objectiveDriftThreshold: number;
  circuitBreakerCooldownMs: number;
}

export const DEFAULT_CONFIG: LoopDetectionV2Config = {
  enabled: true,
  warningThreshold: 5,
  criticalThreshold: 10,
  maxConsecutiveReasoningTurns: 3,
  objectiveDriftThreshold: 0.15,
  circuitBreakerCooldownMs: 30_000,
};

// --- Stop words for keyword extraction ---

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "are",
  "but",
  "not",
  "you",
  "all",
  "can",
  "had",
  "her",
  "was",
  "one",
  "our",
  "out",
  "has",
  "have",
  "been",
  "some",
  "them",
  "than",
  "its",
  "over",
  "such",
  "that",
  "this",
  "with",
  "will",
  "each",
  "from",
  "they",
  "were",
  "which",
  "their",
  "said",
  "what",
  "about",
  "would",
  "make",
  "like",
  "just",
  "into",
  "when",
  "could",
  "time",
  "very",
  "your",
  "should",
  "also",
  "then",
  "other",
  "more",
  "these",
  "does",
  "being",
  "here",
  "where",
  "after",
  "most",
  "only",
  "come",
  "made",
  "find",
  "back",
  "many",
  "those",
  "well",
  "much",
  "take",
  "before",
  "same",
  "there",
]);

const MIN_KEYWORD_LENGTH = 4;

// --- Keyword extraction ---

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= MIN_KEYWORD_LENGTH && !STOP_WORDS.has(w));
}

function extractToolKeywords(
  tools: Array<{ name: string; args?: Record<string, unknown> }>,
): string[] {
  const words: string[] = [];
  for (const tool of tools) {
    // Split tool names on underscores/camelCase boundaries
    words.push(
      ...extractKeywords(tool.name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ")),
    );
    if (tool.args) {
      for (const value of Object.values(tool.args)) {
        if (typeof value === "string") {
          words.push(...extractKeywords(value));
        }
      }
    }
  }
  return words;
}

// --- Objective drift detection ---

export function detectObjectiveDrift(
  originalObjective: string,
  recentTools: Array<{ name: string; args?: Record<string, unknown> }>,
  recentOutputSnippets?: string[],
): ObjectiveDriftResult {
  const originalKeywords = [...new Set(extractKeywords(originalObjective))];

  if (originalKeywords.length === 0) {
    return { drifted: false, similarity: 1.0, originalKeywords, currentKeywords: [] };
  }
  if (recentTools.length === 0) {
    return { drifted: false, similarity: 1.0, originalKeywords, currentKeywords: [] };
  }

  const toolKw = extractToolKeywords(recentTools);
  const snippetKw = recentOutputSnippets
    ? recentOutputSnippets.flatMap((s) => extractKeywords(s))
    : [];
  const currentKeywords = [...new Set([...toolKw, ...snippetKw])];

  if (currentKeywords.length === 0) {
    return {
      drifted: true,
      similarity: 0,
      originalKeywords,
      currentKeywords,
      reason: "No recognizable keywords in recent tool activity",
    };
  }

  const originalSet = new Set(originalKeywords);
  const intersectionCount = currentKeywords.filter((kw) => originalSet.has(kw)).length;
  const similarity = intersectionCount / originalKeywords.length;
  const drifted = similarity < DEFAULT_CONFIG.objectiveDriftThreshold;

  return {
    drifted,
    similarity,
    originalKeywords,
    currentKeywords,
    reason: drifted
      ? `Tool activity keywords have low overlap (${(similarity * 100).toFixed(1)}%) with original objective`
      : undefined,
  };
}

// --- Reasoning loop detection ---

export function detectReasoningLoop(
  turns: Array<{ hasToolCall: boolean; hasUserOutput: boolean; tokenCount: number }>,
  maxConsecutive: number = DEFAULT_CONFIG.maxConsecutiveReasoningTurns,
): { looping: boolean; consecutiveCount: number; totalReasoningTokens: number } {
  let consecutiveCount = 0;
  let totalReasoningTokens = 0;

  // Walk backward from most recent turn
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const turn = turns[i];
    if (!turn) {
      break;
    }
    if (turn.hasToolCall || turn.hasUserOutput) {
      break;
    }
    consecutiveCount += 1;
    totalReasoningTokens += turn.tokenCount;
  }

  return {
    looping: consecutiveCount >= maxConsecutive,
    consecutiveCount,
    totalReasoningTokens,
  };
}

// --- Circuit breaker ---

export function createCircuitBreaker(
  cooldownMs: number = DEFAULT_CONFIG.circuitBreakerCooldownMs,
): CircuitBreaker {
  return { state: "closed", failureCount: 0, cooldownMs };
}

export function recordFailure(breaker: CircuitBreaker): CircuitBreaker {
  const failureCount = breaker.failureCount + 1;
  const now = Date.now();

  if (breaker.state === "closed") {
    // First failure transitions to degraded
    return { ...breaker, state: "degraded", failureCount, degradedSince: now };
  }
  if (breaker.state === "degraded") {
    // Second+ failure in degraded opens the circuit
    return { ...breaker, state: "open", failureCount, openSince: now };
  }
  // Already open — just increment
  return { ...breaker, failureCount };
}

export function recordSuccess(breaker: CircuitBreaker): CircuitBreaker {
  if (breaker.state === "closed") {
    return breaker;
  }
  // Any success from degraded or open resets to closed
  return { state: "closed", failureCount: 0, cooldownMs: breaker.cooldownMs };
}

export function checkCircuit(breaker: CircuitBreaker): {
  allowed: boolean;
  state: CircuitState;
  reason?: string;
} {
  if (breaker.state === "closed") {
    return { allowed: true, state: "closed" };
  }
  if (breaker.state === "degraded") {
    return {
      allowed: true,
      state: "degraded",
      reason: "Circuit degraded — failures detected, proceeding with caution",
    };
  }
  // Open — check cooldown
  if (breaker.openSince) {
    const elapsed = Date.now() - breaker.openSince;
    if (elapsed >= breaker.cooldownMs) {
      return { allowed: true, state: "open", reason: "Cooldown elapsed — allowing probe attempt" };
    }
  }
  return {
    allowed: false,
    state: "open",
    reason: `Circuit open — blocked until cooldown (${breaker.cooldownMs}ms) elapses`,
  };
}

// --- Tool repetition detection ---

const DEFAULT_REPETITION_WINDOW = 20;
const REPETITION_THRESHOLD = 5;

export function detectToolRepetition(
  history: Array<{ tool: string; argsHash?: string }>,
  windowSize: number = DEFAULT_REPETITION_WINDOW,
): { repeating: boolean; pattern?: string; count: number } {
  if (history.length === 0) {
    return { repeating: false, count: 0 };
  }

  const window = history.slice(-windowSize);
  // Count occurrences of each tool+argsHash combo
  const counts = new Map<string, number>();
  for (const entry of window) {
    const key = entry.argsHash ? `${entry.tool}:${entry.argsHash}` : entry.tool;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  let maxKey = "";
  let maxCount = 0;
  for (const [key, count] of counts) {
    if (count > maxCount) {
      maxKey = key;
      maxCount = count;
    }
  }

  return {
    repeating: maxCount >= REPETITION_THRESHOLD,
    pattern: maxCount >= REPETITION_THRESHOLD ? maxKey : undefined,
    count: maxCount,
  };
}

// --- Combined detector ---

interface DetectionEntry {
  detector: string;
  severity: "warn" | "critical";
  message: string;
}

export function runAllDetectors(context: {
  config: LoopDetectionV2Config;
  originalObjective: string;
  toolHistory: Array<{ name: string; args?: Record<string, unknown>; argsHash?: string }>;
  turnHistory: Array<{ hasToolCall: boolean; hasUserOutput: boolean; tokenCount: number }>;
  circuitBreaker: CircuitBreaker;
}): {
  shouldBlock: boolean;
  shouldWarn: boolean;
  detections: DetectionEntry[];
  updatedBreaker: CircuitBreaker;
} {
  const { config, originalObjective, toolHistory, turnHistory } = context;
  let breaker = { ...context.circuitBreaker };
  const detections: DetectionEntry[] = [];

  if (!config.enabled) {
    return { shouldBlock: false, shouldWarn: false, detections, updatedBreaker: breaker };
  }

  // 1. Circuit breaker check
  const circuitCheck = checkCircuit(breaker);
  if (!circuitCheck.allowed) {
    detections.push({
      detector: "circuit_breaker",
      severity: "critical",
      message: circuitCheck.reason ?? "Circuit breaker open",
    });
    return { shouldBlock: true, shouldWarn: false, detections, updatedBreaker: breaker };
  }

  // 2. Objective drift
  const drift = detectObjectiveDrift(originalObjective, toolHistory);
  if (drift.drifted) {
    detections.push({
      detector: "objective_drift",
      severity: "warn",
      message:
        drift.reason ?? `Objective drift detected (similarity: ${drift.similarity.toFixed(2)})`,
    });
  }

  // 3. Reasoning loop
  const reasoning = detectReasoningLoop(turnHistory, config.maxConsecutiveReasoningTurns);
  if (reasoning.looping) {
    detections.push({
      detector: "reasoning_loop",
      severity: reasoning.consecutiveCount >= config.criticalThreshold ? "critical" : "warn",
      message: `${reasoning.consecutiveCount} consecutive reasoning turns without tool calls or output (${reasoning.totalReasoningTokens} tokens)`,
    });
  }

  // 4. Tool repetition
  const repetitionHistory = toolHistory.map((t) => ({ tool: t.name, argsHash: t.argsHash }));
  const repetition = detectToolRepetition(repetitionHistory);
  if (repetition.repeating) {
    const severity = repetition.count >= config.criticalThreshold ? "critical" : "warn";
    detections.push({
      detector: "tool_repetition",
      severity,
      message: `Tool pattern "${repetition.pattern}" repeated ${repetition.count} times`,
    });
  }

  // Determine overall severity
  const hasCritical = detections.some((d) => d.severity === "critical");
  const hasWarn = detections.some((d) => d.severity === "warn");

  // Update circuit breaker based on detections
  if (hasCritical) {
    breaker = recordFailure(recordFailure(breaker)); // double-tap to open
  } else if (hasWarn) {
    breaker = recordFailure(breaker);
  } else if (detections.length === 0) {
    breaker = recordSuccess(breaker);
  }

  return {
    shouldBlock: hasCritical,
    shouldWarn: hasWarn && !hasCritical,
    detections,
    updatedBreaker: breaker,
  };
}
