import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkCircuit,
  createCircuitBreaker,
  DEFAULT_CONFIG,
  detectObjectiveDrift,
  detectReasoningLoop,
  detectToolRepetition,
  recordFailure,
  recordSuccess,
  runAllDetectors,
  type CircuitBreaker,
  type LoopDetectionV2Config,
} from "./loop-detection-v2.js";

beforeEach(() => {
  vi.useFakeTimers({ now: 1_000_000 });
});
afterEach(() => {
  vi.useRealTimers();
});

// --- Objective drift ---

describe("detectObjectiveDrift", () => {
  it("returns no drift when tools relate to objective", () => {
    const result = detectObjectiveDrift("deploy the application server", [
      { name: "deploy_server", args: { target: "application" } },
      { name: "check_status", args: { service: "server" } },
    ]);
    expect(result.drifted).toBe(false);
    expect(result.similarity).toBeGreaterThan(0.15);
  });

  it("flags drift when tools are unrelated to objective", () => {
    const result = detectObjectiveDrift("deploy the application server", [
      { name: "send_email", args: { to: "user@example.com" } },
      { name: "create_calendar_event", args: { title: "meeting" } },
    ]);
    expect(result.drifted).toBe(true);
    expect(result.similarity).toBeLessThan(0.15);
    expect(result.reason).toBeDefined();
  });

  it("handles empty tool list without drift", () => {
    const result = detectObjectiveDrift("deploy server", []);
    expect(result.drifted).toBe(false);
    expect(result.similarity).toBe(1.0);
  });

  it("handles empty objective without drift", () => {
    const result = detectObjectiveDrift("", [{ name: "some_tool" }]);
    expect(result.drifted).toBe(false);
    expect(result.similarity).toBe(1.0);
  });

  it("uses output snippets for similarity", () => {
    const result = detectObjectiveDrift(
      "deploy the application server",
      [{ name: "run_command" }],
      ["deploying application to production server"],
    );
    expect(result.drifted).toBe(false);
    expect(result.similarity).toBeGreaterThan(0);
  });

  it("flags drift when no keywords match from tools", () => {
    const result = detectObjectiveDrift("upgrade database schema migrations", [
      { name: "x", args: { y: "z" } },
    ]);
    expect(result.drifted).toBe(true);
    expect(result.similarity).toBe(0);
  });
});

// --- Reasoning loop ---

describe("detectReasoningLoop", () => {
  it("detects 3+ consecutive reasoning turns", () => {
    const turns = [
      { hasToolCall: false, hasUserOutput: false, tokenCount: 100 },
      { hasToolCall: false, hasUserOutput: false, tokenCount: 200 },
      { hasToolCall: false, hasUserOutput: false, tokenCount: 150 },
    ];
    const result = detectReasoningLoop(turns);
    expect(result.looping).toBe(true);
    expect(result.consecutiveCount).toBe(3);
    expect(result.totalReasoningTokens).toBe(450);
  });

  it("does not flag when tool call breaks the streak", () => {
    const turns = [
      { hasToolCall: false, hasUserOutput: false, tokenCount: 100 },
      { hasToolCall: true, hasUserOutput: false, tokenCount: 50 },
      { hasToolCall: false, hasUserOutput: false, tokenCount: 100 },
    ];
    const result = detectReasoningLoop(turns);
    expect(result.looping).toBe(false);
    expect(result.consecutiveCount).toBe(1);
  });

  it("does not flag when user output breaks the streak", () => {
    const turns = [
      { hasToolCall: false, hasUserOutput: false, tokenCount: 100 },
      { hasToolCall: false, hasUserOutput: true, tokenCount: 50 },
      { hasToolCall: false, hasUserOutput: false, tokenCount: 100 },
    ];
    const result = detectReasoningLoop(turns);
    expect(result.looping).toBe(false);
    expect(result.consecutiveCount).toBe(1);
  });

  it("handles empty turn history", () => {
    const result = detectReasoningLoop([]);
    expect(result.looping).toBe(false);
    expect(result.consecutiveCount).toBe(0);
    expect(result.totalReasoningTokens).toBe(0);
  });

  it("respects custom maxConsecutive", () => {
    const turns = [
      { hasToolCall: false, hasUserOutput: false, tokenCount: 100 },
      { hasToolCall: false, hasUserOutput: false, tokenCount: 100 },
    ];
    expect(detectReasoningLoop(turns, 2).looping).toBe(true);
    expect(detectReasoningLoop(turns, 3).looping).toBe(false);
  });
});

// --- Circuit breaker ---

describe("CircuitBreaker", () => {
  it("starts in closed state", () => {
    const breaker = createCircuitBreaker();
    expect(breaker.state).toBe("closed");
    expect(breaker.failureCount).toBe(0);
  });

  it("transitions closed -> degraded on first failure", () => {
    const breaker = recordFailure(createCircuitBreaker());
    expect(breaker.state).toBe("degraded");
    expect(breaker.failureCount).toBe(1);
    expect(breaker.degradedSince).toBeDefined();
  });

  it("transitions degraded -> open on second failure", () => {
    const breaker = recordFailure(recordFailure(createCircuitBreaker()));
    expect(breaker.state).toBe("open");
    expect(breaker.failureCount).toBe(2);
    expect(breaker.openSince).toBeDefined();
  });

  it("resets to closed on success from degraded", () => {
    const degraded = recordFailure(createCircuitBreaker());
    const recovered = recordSuccess(degraded);
    expect(recovered.state).toBe("closed");
    expect(recovered.failureCount).toBe(0);
  });

  it("resets to closed on success from open (after cooldown)", () => {
    const open = recordFailure(recordFailure(createCircuitBreaker()));
    const recovered = recordSuccess(open);
    expect(recovered.state).toBe("closed");
    expect(recovered.failureCount).toBe(0);
  });

  it("blocks when open and cooldown not elapsed", () => {
    const breaker = recordFailure(recordFailure(createCircuitBreaker(5000)));
    const check = checkCircuit(breaker);
    expect(check.allowed).toBe(false);
    expect(check.state).toBe("open");
  });

  it("allows probe after cooldown elapses", () => {
    const breaker = recordFailure(recordFailure(createCircuitBreaker(5000)));
    vi.advanceTimersByTime(5000);
    const check = checkCircuit(breaker);
    expect(check.allowed).toBe(true);
    expect(check.state).toBe("open");
    expect(check.reason).toContain("Cooldown elapsed");
  });

  it("allows in degraded state with warning", () => {
    const breaker = recordFailure(createCircuitBreaker());
    const check = checkCircuit(breaker);
    expect(check.allowed).toBe(true);
    expect(check.state).toBe("degraded");
    expect(check.reason).toContain("degraded");
  });

  it("success on closed is a no-op", () => {
    const breaker = createCircuitBreaker();
    const same = recordSuccess(breaker);
    expect(same).toBe(breaker);
  });

  it("uses custom cooldown", () => {
    const breaker = createCircuitBreaker(60_000);
    expect(breaker.cooldownMs).toBe(60_000);
  });
});

// --- Tool repetition ---

describe("detectToolRepetition", () => {
  it("detects same tool called 5+ times", () => {
    const history = Array.from({ length: 6 }, () => ({ tool: "read_file", argsHash: "abc123" }));
    const result = detectToolRepetition(history);
    expect(result.repeating).toBe(true);
    expect(result.count).toBe(6);
    expect(result.pattern).toBe("read_file:abc123");
  });

  it("does not flag under threshold", () => {
    const history = Array.from({ length: 4 }, () => ({ tool: "read_file", argsHash: "abc123" }));
    const result = detectToolRepetition(history);
    expect(result.repeating).toBe(false);
    expect(result.count).toBe(4);
  });

  it("handles empty history", () => {
    const result = detectToolRepetition([]);
    expect(result.repeating).toBe(false);
    expect(result.count).toBe(0);
  });

  it("handles single tool call", () => {
    const result = detectToolRepetition([{ tool: "exec" }]);
    expect(result.repeating).toBe(false);
    expect(result.count).toBe(1);
  });

  it("uses tool name only when no argsHash", () => {
    const history = Array.from({ length: 5 }, () => ({ tool: "list_files" }));
    const result = detectToolRepetition(history);
    expect(result.repeating).toBe(true);
    expect(result.pattern).toBe("list_files");
  });

  it("distinguishes different argsHashes", () => {
    const history = [
      { tool: "read_file", argsHash: "a" },
      { tool: "read_file", argsHash: "b" },
      { tool: "read_file", argsHash: "a" },
      { tool: "read_file", argsHash: "b" },
      { tool: "read_file", argsHash: "c" },
    ];
    const result = detectToolRepetition(history);
    expect(result.repeating).toBe(false);
  });

  it("respects window size", () => {
    // 10 items total, but window of 3 only sees the last 3
    const history = [
      ...Array.from({ length: 7 }, () => ({ tool: "old_tool", argsHash: "x" })),
      { tool: "new_tool", argsHash: "y" },
      { tool: "new_tool", argsHash: "y" },
      { tool: "new_tool", argsHash: "y" },
    ];
    const result = detectToolRepetition(history, 3);
    expect(result.repeating).toBe(false); // only 3, threshold is 5
    expect(result.count).toBe(3);
  });
});

// --- Combined detector ---

describe("runAllDetectors", () => {
  const baseConfig: LoopDetectionV2Config = { ...DEFAULT_CONFIG };

  function makeContext(overrides: {
    objective?: string;
    tools?: Array<{ name: string; args?: Record<string, unknown>; argsHash?: string }>;
    turns?: Array<{ hasToolCall: boolean; hasUserOutput: boolean; tokenCount: number }>;
    breaker?: CircuitBreaker;
    config?: Partial<LoopDetectionV2Config>;
  }) {
    return {
      config: { ...baseConfig, ...overrides.config },
      originalObjective: overrides.objective ?? "deploy the application",
      toolHistory: overrides.tools ?? [],
      turnHistory: overrides.turns ?? [],
      circuitBreaker: overrides.breaker ?? createCircuitBreaker(),
    };
  }

  it("returns clean result when nothing is wrong", () => {
    const result = runAllDetectors(
      makeContext({
        tools: [{ name: "deploy_app", args: { target: "application" } }],
        turns: [{ hasToolCall: true, hasUserOutput: false, tokenCount: 50 }],
      }),
    );
    expect(result.shouldBlock).toBe(false);
    expect(result.shouldWarn).toBe(false);
    expect(result.detections).toHaveLength(0);
    expect(result.updatedBreaker.state).toBe("closed");
  });

  it("warns on objective drift", () => {
    const result = runAllDetectors(
      makeContext({
        tools: [{ name: "send_email", args: { to: "someone@test.com" } }],
      }),
    );
    expect(result.shouldWarn).toBe(true);
    expect(result.shouldBlock).toBe(false);
    expect(result.detections.some((d) => d.detector === "objective_drift")).toBe(true);
  });

  it("warns on reasoning loop", () => {
    const result = runAllDetectors(
      makeContext({
        tools: [{ name: "deploy_app" }],
        turns: [
          { hasToolCall: false, hasUserOutput: false, tokenCount: 100 },
          { hasToolCall: false, hasUserOutput: false, tokenCount: 100 },
          { hasToolCall: false, hasUserOutput: false, tokenCount: 100 },
        ],
      }),
    );
    expect(result.shouldWarn).toBe(true);
    expect(result.detections.some((d) => d.detector === "reasoning_loop")).toBe(true);
  });

  it("blocks when circuit breaker is open", () => {
    const openBreaker = recordFailure(recordFailure(createCircuitBreaker(60_000)));
    const result = runAllDetectors(makeContext({ breaker: openBreaker }));
    expect(result.shouldBlock).toBe(true);
    expect(result.detections.some((d) => d.detector === "circuit_breaker")).toBe(true);
  });

  it("degrades breaker on warning detections", () => {
    const result = runAllDetectors(
      makeContext({
        tools: [{ name: "send_email", args: { to: "someone@test.com" } }],
      }),
    );
    expect(result.updatedBreaker.state).toBe("degraded");
  });

  it("opens breaker on critical detections", () => {
    // Create enough repetitions to be critical (count >= criticalThreshold)
    const tools = Array.from({ length: 12 }, () => ({
      name: "bad_tool",
      argsHash: "same",
    }));
    const result = runAllDetectors(
      makeContext({
        tools,
        config: { criticalThreshold: 10 },
      }),
    );
    expect(result.shouldBlock).toBe(true);
    expect(result.updatedBreaker.state).toBe("open");
  });

  it("respects enabled=false", () => {
    const result = runAllDetectors(
      makeContext({
        config: { enabled: false },
        tools: Array.from({ length: 20 }, () => ({ name: "bad_tool", argsHash: "same" })),
      }),
    );
    expect(result.shouldBlock).toBe(false);
    expect(result.shouldWarn).toBe(false);
    expect(result.detections).toHaveLength(0);
  });

  it("handles multiple simultaneous detections", () => {
    const result = runAllDetectors(
      makeContext({
        // Drift: unrelated tools
        tools: Array.from({ length: 6 }, () => ({
          name: "send_email",
          args: { to: "x@y.com" },
          argsHash: "same",
        })),
        // Reasoning loop
        turns: [
          { hasToolCall: false, hasUserOutput: false, tokenCount: 100 },
          { hasToolCall: false, hasUserOutput: false, tokenCount: 100 },
          { hasToolCall: false, hasUserOutput: false, tokenCount: 100 },
        ],
      }),
    );
    expect(result.detections.length).toBeGreaterThanOrEqual(2);
    const detectorNames = result.detections.map((d) => d.detector);
    expect(detectorNames).toContain("objective_drift");
    expect(detectorNames).toContain("reasoning_loop");
  });

  it("uses lowered thresholds from config", () => {
    const result = runAllDetectors(
      makeContext({
        config: { warningThreshold: 2, criticalThreshold: 4 },
        tools: Array.from({ length: 5 }, () => ({ name: "read_file", argsHash: "abc" })),
      }),
    );
    // 5 repetitions >= criticalThreshold of 4
    expect(result.shouldBlock).toBe(true);
  });

  it("handles very long history without errors", () => {
    const tools = Array.from({ length: 200 }, (_, i) => ({
      name: `tool_${i % 50}`,
      args: { index: i },
      argsHash: `hash_${i % 50}`,
    }));
    const turns = Array.from({ length: 200 }, (_, i) => ({
      hasToolCall: i % 3 === 0,
      hasUserOutput: i % 7 === 0,
      tokenCount: 50,
    }));
    const result = runAllDetectors(makeContext({ tools, turns }));
    expect(result).toBeDefined();
    expect(typeof result.shouldBlock).toBe("boolean");
  });
});
