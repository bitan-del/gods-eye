import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type BudgetConfig,
  checkBudget,
  createBudgetState,
  formatBudgetStatus,
  recordUsage,
  resetExpiredWindows,
} from "./token-budget.js";

// Stable "now" for deterministic tests.
const NOW = 1_700_000_000_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createBudgetState", () => {
  it("returns zeroed counters anchored to current time", () => {
    const state = createBudgetState();
    expect(state.sessionTokensUsed).toBe(0);
    expect(state.hourlyTokensUsed).toBe(0);
    expect(state.dailyCostUsed).toBe(0);
    expect(state.hourWindowStart).toBe(NOW);
    expect(state.dayWindowStart).toBe(NOW);
  });
});

describe("recordUsage", () => {
  it("accumulates tokens and cost immutably", () => {
    const s0 = createBudgetState();
    const s1 = recordUsage(s0, 1000, 0.05);
    const s2 = recordUsage(s1, 2000, 0.1);

    // Original unchanged.
    expect(s0.sessionTokensUsed).toBe(0);

    expect(s2.sessionTokensUsed).toBe(3000);
    expect(s2.hourlyTokensUsed).toBe(3000);
    expect(s2.dailyCostUsed).toBeCloseTo(0.15);
  });
});

describe("checkBudget", () => {
  const fullConfig: BudgetConfig = {
    maxTokensPerSession: 500_000,
    maxTokensPerHour: 1_000_000,
    maxCostPerDay: 5.0,
  };

  it("allows when under all limits", () => {
    const state = recordUsage(createBudgetState(), 10_000, 0.5);
    const result = checkBudget(state, fullConfig);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(result.warning).toBeUndefined();
    expect(result.utilization.session).toBeCloseTo(0.02);
    expect(result.utilization.hourly).toBeCloseTo(0.01);
    expect(result.utilization.daily).toBeCloseTo(0.1);
  });

  it("blocks when session token limit exceeded", () => {
    const state = recordUsage(createBudgetState(), 500_000, 1.0);
    const result = checkBudget(state, fullConfig);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Session token limit reached");
  });

  it("blocks when hourly token limit exceeded", () => {
    const state = recordUsage(createBudgetState(), 1_000_000, 1.0);
    const config: BudgetConfig = { maxTokensPerHour: 1_000_000 };
    const result = checkBudget(state, config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Hourly token limit reached");
  });

  it("blocks when daily cost limit exceeded", () => {
    const state = recordUsage(createBudgetState(), 100, 5.0);
    const config: BudgetConfig = { maxCostPerDay: 5.0 };
    const result = checkBudget(state, config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Daily cost limit reached");
  });

  it("emits warning at 80% threshold (default)", () => {
    // 80% of 500k = 400k
    const state = recordUsage(createBudgetState(), 400_000, 0.1);
    const result = checkBudget(state, fullConfig);
    expect(result.allowed).toBe(true);
    expect(result.warning).toContain("Session tokens at 80%");
  });

  it("respects custom warning threshold", () => {
    const config: BudgetConfig = {
      maxTokensPerSession: 100_000,
      warningThreshold: 0.5,
    };
    // 50% of 100k = 50k
    const state = recordUsage(createBudgetState(), 50_000, 0);
    const result = checkBudget(state, config);
    expect(result.allowed).toBe(true);
    expect(result.warning).toContain("Session tokens at 50%");
  });

  it("returns zero utilization for unconfigured limits", () => {
    const state = recordUsage(createBudgetState(), 999_999, 99.99);
    const result = checkBudget(state, {});
    expect(result.allowed).toBe(true);
    expect(result.utilization.session).toBe(0);
    expect(result.utilization.hourly).toBe(0);
    expect(result.utilization.daily).toBe(0);
  });

  it("handles partial config (only some limits set)", () => {
    const config: BudgetConfig = { maxTokensPerSession: 100_000 };
    const state = recordUsage(createBudgetState(), 100_000, 10.0);
    const result = checkBudget(state, config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Session token limit");
    // Unconfigured limits remain 0.
    expect(result.utilization.hourly).toBe(0);
    expect(result.utilization.daily).toBe(0);
  });
});

describe("resetExpiredWindows", () => {
  it("resets hourly window after 1 hour", () => {
    let state = createBudgetState();
    state = recordUsage(state, 5000, 0.5);

    // Advance 1 hour.
    vi.setSystemTime(NOW + 3_600_000);
    const reset = resetExpiredWindows(state);

    expect(reset.hourlyTokensUsed).toBe(0);
    expect(reset.hourWindowStart).toBe(NOW + 3_600_000);
    // Session and daily should remain.
    expect(reset.sessionTokensUsed).toBe(5000);
    expect(reset.dailyCostUsed).toBeCloseTo(0.5);
  });

  it("resets daily window after 24 hours", () => {
    let state = createBudgetState();
    state = recordUsage(state, 5000, 2.5);

    // Advance 24 hours.
    vi.setSystemTime(NOW + 86_400_000);
    const reset = resetExpiredWindows(state);

    expect(reset.dailyCostUsed).toBe(0);
    expect(reset.dayWindowStart).toBe(NOW + 86_400_000);
    // Session tokens persist across day resets.
    expect(reset.sessionTokensUsed).toBe(5000);
  });

  it("does not reset when windows have not expired", () => {
    let state = createBudgetState();
    state = recordUsage(state, 5000, 1.0);

    // Advance only 30 minutes.
    vi.setSystemTime(NOW + 1_800_000);
    const reset = resetExpiredWindows(state);

    expect(reset.hourlyTokensUsed).toBe(5000);
    expect(reset.dailyCostUsed).toBeCloseTo(1.0);
  });
});

describe("formatBudgetStatus", () => {
  it("formats all configured limits", () => {
    const config: BudgetConfig = {
      maxTokensPerSession: 500_000,
      maxTokensPerHour: 1_000_000,
      maxCostPerDay: 5.0,
    };
    const state = recordUsage(createBudgetState(), 45_000, 1.23);
    const output = formatBudgetStatus(state, config);

    expect(output).toContain("Session:");
    expect(output).toContain("45,000");
    expect(output).toContain("500,000");
    expect(output).toContain("9%");
    expect(output).toContain("Hourly:");
    expect(output).toContain("1,000,000");
    expect(output).toContain("Daily:");
    expect(output).toContain("$1.23");
    expect(output).toContain("$5.00");
    expect(output).toContain("25%");
  });

  it("returns fallback when no limits configured", () => {
    const output = formatBudgetStatus(createBudgetState(), {});
    expect(output).toBe("No budget limits configured");
  });

  it("only shows configured limits", () => {
    const config: BudgetConfig = { maxTokensPerSession: 100_000 };
    const state = recordUsage(createBudgetState(), 10_000, 2.0);
    const output = formatBudgetStatus(state, config);

    expect(output).toContain("Session:");
    expect(output).not.toContain("Hourly:");
    expect(output).not.toContain("Daily:");
  });
});
