import { describe, expect, it } from "vitest";
import { createContextMonitor } from "./context-health-monitor.js";

describe("createContextMonitor", () => {
  it("fresh monitor starts healthy", () => {
    const monitor = createContextMonitor({ contextWindowSize: 200_000 });
    const health = monitor.getHealth();
    expect(health.status).toBe("healthy");
    expect(health.usedTokens).toBe(0);
    expect(health.availableTokens).toBe(200_000);
    expect(health.utilizationRatio).toBe(0);
    expect(health.compactionImminent).toBe(false);
    expect(health.estimatedTurnsRemaining).toBe(Infinity);
  });

  it("recording turns increases utilization", () => {
    const monitor = createContextMonitor({ contextWindowSize: 100_000 });
    monitor.recordTurn(10_000, "user_message");
    monitor.recordTurn(10_000, "tool_call");
    const health = monitor.getHealth();
    expect(health.usedTokens).toBe(20_000);
    expect(health.availableTokens).toBe(80_000);
    expect(health.utilizationRatio).toBeCloseTo(0.2);
    expect(health.status).toBe("healthy");
  });

  it("warning threshold triggers", () => {
    const monitor = createContextMonitor({
      contextWindowSize: 100_000,
      warningThreshold: 0.7,
      criticalThreshold: 0.85,
    });
    monitor.recordTurn(75_000);
    const health = monitor.getHealth();
    expect(health.status).toBe("warning");
    expect(health.statusMessage).toContain("WARNING");
  });

  it("critical threshold triggers", () => {
    const monitor = createContextMonitor({
      contextWindowSize: 100_000,
      warningThreshold: 0.7,
      criticalThreshold: 0.85,
    });
    monitor.recordTurn(90_000);
    const health = monitor.getHealth();
    expect(health.status).toBe("critical");
    expect(health.statusMessage).toContain("CRITICAL");
  });

  it("compaction reduces utilization", () => {
    const monitor = createContextMonitor({ contextWindowSize: 100_000 });
    monitor.recordTurn(80_000);
    expect(monitor.getHealth().usedTokens).toBe(80_000);
    monitor.recordCompaction(50_000);
    const health = monitor.getHealth();
    expect(health.usedTokens).toBe(30_000);
    expect(health.availableTokens).toBe(70_000);
    expect(health.status).toBe("healthy");
  });

  it("compaction does not go below zero", () => {
    const monitor = createContextMonitor({ contextWindowSize: 100_000 });
    monitor.recordTurn(10_000);
    monitor.recordCompaction(50_000);
    expect(monitor.getHealth().usedTokens).toBe(0);
  });

  it("average tokens per turn calculation", () => {
    const monitor = createContextMonitor({ contextWindowSize: 200_000 });
    monitor.recordTurn(1_000);
    monitor.recordTurn(3_000);
    monitor.recordTurn(2_000);
    expect(monitor.getAverageTokensPerTurn()).toBe(2_000);
  });

  it("average tokens per turn is zero with no turns", () => {
    const monitor = createContextMonitor({});
    expect(monitor.getAverageTokensPerTurn()).toBe(0);
  });

  it("estimated turns remaining", () => {
    const monitor = createContextMonitor({ contextWindowSize: 100_000 });
    // Each turn uses 5000 tokens
    monitor.recordTurn(5_000);
    monitor.recordTurn(5_000);
    const health = monitor.getHealth();
    // 90000 remaining / 5000 avg = 18 turns
    expect(health.estimatedTurnsRemaining).toBe(18);
  });

  it("history tracking", () => {
    const monitor = createContextMonitor({ contextWindowSize: 200_000 });
    monitor.recordTurn(1_000, "user_message");
    monitor.recordTurn(2_000, "tool_call");
    monitor.recordCompaction(500);
    const history = monitor.getHistory();
    expect(history).toHaveLength(3);
    expect(history[0].event).toBe("user_message");
    expect(history[0].turnNumber).toBe(1);
    expect(history[1].event).toBe("tool_call");
    expect(history[1].turnNumber).toBe(2);
    expect(history[2].event).toBe("compaction");
    expect(history[2].usedTokens).toBe(2_500);
  });

  it("history is capped at maxHistoryEntries", () => {
    const monitor = createContextMonitor({
      contextWindowSize: 1_000_000,
      maxHistoryEntries: 5,
    });
    for (let i = 0; i < 10; i++) {
      monitor.recordTurn(100);
    }
    const history = monitor.getHistory();
    expect(history).toHaveLength(5);
    // Should keep the most recent entries
    expect(history[0].turnNumber).toBe(6);
    expect(history[4].turnNumber).toBe(10);
  });

  it("formatStatus output includes token counts and percentage", () => {
    const monitor = createContextMonitor({ contextWindowSize: 200_000 });
    monitor.recordTurn(142_000);
    const status = monitor.formatStatus();
    expect(status).toContain("142,000");
    expect(status).toContain("200,000");
    expect(status).toContain("71%");
    expect(status).toContain("WARNING");
  });

  it("formatStatus includes estimated turns when available", () => {
    const monitor = createContextMonitor({ contextWindowSize: 200_000 });
    monitor.recordTurn(10_000);
    monitor.recordTurn(10_000);
    const status = monitor.formatStatus();
    expect(status).toContain("turns remaining");
  });

  it("reset clears state", () => {
    const monitor = createContextMonitor({ contextWindowSize: 100_000 });
    monitor.recordTurn(50_000);
    monitor.recordTurn(20_000);
    monitor.reset();
    const health = monitor.getHealth();
    expect(health.usedTokens).toBe(0);
    expect(health.status).toBe("healthy");
    expect(monitor.getHistory()).toHaveLength(0);
    expect(monitor.getAverageTokensPerTurn()).toBe(0);
  });

  it("custom thresholds", () => {
    const monitor = createContextMonitor({
      contextWindowSize: 100_000,
      warningThreshold: 0.5,
      criticalThreshold: 0.6,
    });
    monitor.recordTurn(55_000);
    expect(monitor.getHealth().status).toBe("warning");
    monitor.recordTurn(10_000);
    expect(monitor.getHealth().status).toBe("critical");
  });

  it("compactionImminent reflects threshold proximity", () => {
    const monitor = createContextMonitor({
      contextWindowSize: 100_000,
      compactionThreshold: 0.9,
    });
    // 80% = compactionThreshold - 0.1 => imminent
    monitor.recordTurn(80_000);
    expect(monitor.getHealth().compactionImminent).toBe(true);
    monitor.reset();
    monitor.recordTurn(70_000);
    expect(monitor.getHealth().compactionImminent).toBe(false);
  });

  it("uses default config values when none provided", () => {
    const monitor = createContextMonitor({});
    const health = monitor.getHealth();
    expect(health.totalTokens).toBe(200_000);
  });

  it("getHistory returns a copy", () => {
    const monitor = createContextMonitor({});
    monitor.recordTurn(100);
    const h1 = monitor.getHistory();
    const h2 = monitor.getHistory();
    expect(h1).not.toBe(h2);
    expect(h1).toEqual(h2);
  });

  it("negative tokens are clamped to zero", () => {
    const monitor = createContextMonitor({ contextWindowSize: 100_000 });
    monitor.recordTurn(-500);
    expect(monitor.getHealth().usedTokens).toBe(0);
  });

  it("compaction adds history entry with compaction event", () => {
    const monitor = createContextMonitor({});
    monitor.recordTurn(10_000);
    monitor.recordCompaction(5_000);
    const history = monitor.getHistory();
    const compactionEntry = history.find((e) => e.event === "compaction");
    expect(compactionEntry).toBeDefined();
    expect(compactionEntry!.usedTokens).toBe(5_000);
  });
});
