/**
 * Hard spending caps for AI agent sessions.
 * All functions are pure — no side effects, no globals.
 */

export interface BudgetConfig {
  /** Hard ceiling per session (e.g. 500_000). */
  maxTokensPerSession?: number;
  /** Rate limit per hour (e.g. 1_000_000). */
  maxTokensPerHour?: number;
  /** Dollar cap per day (e.g. 5.00). */
  maxCostPerDay?: number;
  /** Percentage (0–1) at which to emit a warning (default 0.8 = 80%). */
  warningThreshold?: number;
}

export interface BudgetState {
  sessionTokensUsed: number;
  hourlyTokensUsed: number;
  dailyCostUsed: number;
  /** Timestamp (ms) when the current hour window started. */
  hourWindowStart: number;
  /** Timestamp (ms) when the current day window started. */
  dayWindowStart: number;
}

export interface BudgetCheckResult {
  allowed: boolean;
  /** Why the request was blocked. */
  reason?: string;
  /** Warning when approaching a limit. */
  warning?: string;
  utilization: {
    /** 0.0–1.0 fraction of session token limit used. */
    session: number;
    /** 0.0–1.0 fraction of hourly token limit used. */
    hourly: number;
    /** 0.0–1.0 fraction of daily cost limit used. */
    daily: number;
  };
}

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;
const DEFAULT_WARNING_THRESHOLD = 0.8;

/** Create a fresh budget state anchored to the current time. */
export function createBudgetState(): BudgetState {
  const now = Date.now();
  return {
    sessionTokensUsed: 0,
    hourlyTokensUsed: 0,
    dailyCostUsed: 0,
    hourWindowStart: now,
    dayWindowStart: now,
  };
}

/** Record token usage after a model call (returns a new state). */
export function recordUsage(state: BudgetState, tokens: number, cost: number): BudgetState {
  return {
    ...state,
    sessionTokensUsed: state.sessionTokensUsed + tokens,
    hourlyTokensUsed: state.hourlyTokensUsed + tokens,
    dailyCostUsed: state.dailyCostUsed + cost,
  };
}

/** Reset hourly/daily windows if they have expired. */
export function resetExpiredWindows(state: BudgetState): BudgetState {
  const now = Date.now();
  let next = state;

  if (now - state.hourWindowStart >= MS_PER_HOUR) {
    next = { ...next, hourlyTokensUsed: 0, hourWindowStart: now };
  }
  if (now - state.dayWindowStart >= MS_PER_DAY) {
    next = { ...next, dailyCostUsed: 0, dayWindowStart: now };
  }
  return next;
}

function utilization(used: number, limit: number | undefined): number {
  if (!limit || limit <= 0) {
    return 0;
  }
  return Math.min(used / limit, 1);
}

/** Check if the next call is allowed given current budget state. */
export function checkBudget(state: BudgetState, config: BudgetConfig): BudgetCheckResult {
  const threshold = config.warningThreshold ?? DEFAULT_WARNING_THRESHOLD;

  const sessionUtil = utilization(state.sessionTokensUsed, config.maxTokensPerSession);
  const hourlyUtil = utilization(state.hourlyTokensUsed, config.maxTokensPerHour);
  const dailyUtil = utilization(state.dailyCostUsed, config.maxCostPerDay);

  const result: BudgetCheckResult = {
    allowed: true,
    utilization: {
      session: sessionUtil,
      hourly: hourlyUtil,
      daily: dailyUtil,
    },
  };

  // Block checks — any limit at 100% blocks.
  if (config.maxTokensPerSession && state.sessionTokensUsed >= config.maxTokensPerSession) {
    result.allowed = false;
    result.reason = `Session token limit reached: ${fmt(state.sessionTokensUsed)}/${fmt(config.maxTokensPerSession)}`;
    return result;
  }
  if (config.maxTokensPerHour && state.hourlyTokensUsed >= config.maxTokensPerHour) {
    result.allowed = false;
    result.reason = `Hourly token limit reached: ${fmt(state.hourlyTokensUsed)}/${fmt(config.maxTokensPerHour)}`;
    return result;
  }
  if (config.maxCostPerDay && state.dailyCostUsed >= config.maxCostPerDay) {
    result.allowed = false;
    result.reason = `Daily cost limit reached: $${state.dailyCostUsed.toFixed(2)}/$${config.maxCostPerDay.toFixed(2)}`;
    return result;
  }

  // Warning checks — any limit at or above threshold triggers a warning.
  const warnings: string[] = [];
  if (sessionUtil >= threshold && config.maxTokensPerSession) {
    warnings.push(`Session tokens at ${pct(sessionUtil)}`);
  }
  if (hourlyUtil >= threshold && config.maxTokensPerHour) {
    warnings.push(`Hourly tokens at ${pct(hourlyUtil)}`);
  }
  if (dailyUtil >= threshold && config.maxCostPerDay) {
    warnings.push(`Daily cost at ${pct(dailyUtil)}`);
  }
  if (warnings.length > 0) {
    result.warning = warnings.join("; ");
  }

  return result;
}

/** Format a human-readable budget status string. */
export function formatBudgetStatus(state: BudgetState, config: BudgetConfig): string {
  const parts: string[] = [];

  if (config.maxTokensPerSession) {
    const u = utilization(state.sessionTokensUsed, config.maxTokensPerSession);
    parts.push(
      `Session: ${fmt(state.sessionTokensUsed)}/${fmt(config.maxTokensPerSession)} (${pct(u)})`,
    );
  }
  if (config.maxTokensPerHour) {
    const u = utilization(state.hourlyTokensUsed, config.maxTokensPerHour);
    parts.push(
      `Hourly: ${fmt(state.hourlyTokensUsed)}/${fmt(config.maxTokensPerHour)} (${pct(u)})`,
    );
  }
  if (config.maxCostPerDay) {
    const u = utilization(state.dailyCostUsed, config.maxCostPerDay);
    parts.push(
      `Daily: $${state.dailyCostUsed.toFixed(2)}/$${config.maxCostPerDay.toFixed(2)} (${pct(u)})`,
    );
  }

  return parts.length > 0 ? parts.join(" | ") : "No budget limits configured";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a number with thousand separators. */
function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

/** Format a 0–1 fraction as a whole-number percentage string. */
function pct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}
