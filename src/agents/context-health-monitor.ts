// Context window utilization tracking for real-time health monitoring.

export interface ContextHealth {
  totalTokens: number;
  usedTokens: number;
  availableTokens: number;
  utilizationRatio: number; // 0.0-1.0
  estimatedTurnsRemaining: number;
  compactionImminent: boolean; // true if > 80% utilized
  status: "healthy" | "warning" | "critical";
  statusMessage: string;
}

export interface ContextHistoryEntry {
  timestamp: number;
  usedTokens: number;
  turnNumber: number;
  event?: "compaction" | "user_message" | "tool_call" | "tool_result";
}

export interface ContextMonitor {
  /** Record token usage for a turn */
  recordTurn(tokens: number, event?: ContextHistoryEntry["event"]): void;

  /** Record a compaction event (tokens freed) */
  recordCompaction(tokensFreed: number): void;

  /** Get current context health */
  getHealth(): ContextHealth;

  /** Get usage history for charting */
  getHistory(): ContextHistoryEntry[];

  /** Get average tokens per turn (for estimating remaining turns) */
  getAverageTokensPerTurn(): number;

  /** Format a human-readable status string */
  formatStatus(): string;

  /** Reset the monitor */
  reset(): void;
}

export interface ContextMonitorConfig {
  contextWindowSize: number; // total context window (e.g. 200000)
  warningThreshold: number; // ratio to warn at (default 0.7)
  criticalThreshold: number; // ratio for critical (default 0.85)
  compactionThreshold: number; // ratio when compaction triggers (default 0.9)
  maxHistoryEntries: number; // cap history size (default 500)
}

const DEFAULT_CONFIG: ContextMonitorConfig = {
  contextWindowSize: 200_000,
  warningThreshold: 0.7,
  criticalThreshold: 0.85,
  compactionThreshold: 0.9,
  maxHistoryEntries: 500,
};

function resolveConfig(partial: Partial<ContextMonitorConfig>): ContextMonitorConfig {
  return {
    contextWindowSize: partial.contextWindowSize ?? DEFAULT_CONFIG.contextWindowSize,
    warningThreshold: partial.warningThreshold ?? DEFAULT_CONFIG.warningThreshold,
    criticalThreshold: partial.criticalThreshold ?? DEFAULT_CONFIG.criticalThreshold,
    compactionThreshold: partial.compactionThreshold ?? DEFAULT_CONFIG.compactionThreshold,
    maxHistoryEntries: partial.maxHistoryEntries ?? DEFAULT_CONFIG.maxHistoryEntries,
  };
}

function resolveStatus(
  ratio: number,
  warningThreshold: number,
  criticalThreshold: number,
): "healthy" | "warning" | "critical" {
  if (ratio >= criticalThreshold) {
    return "critical";
  }
  if (ratio >= warningThreshold) {
    return "warning";
  }
  return "healthy";
}

function formatTokenCount(n: number): string {
  return n.toLocaleString("en-US");
}

const STATUS_INDICATORS: Record<ContextHealth["status"], string> = {
  healthy: "OK",
  warning: "WARNING",
  critical: "CRITICAL",
};

/** Create a context health monitor */
export function createContextMonitor(config: Partial<ContextMonitorConfig> = {}): ContextMonitor {
  const cfg = resolveConfig(config);
  let usedTokens = 0;
  let turnNumber = 0;
  let history: ContextHistoryEntry[] = [];
  // Track per-turn token deltas for average calculation.
  let turnTokenDeltas: number[] = [];

  function pushHistory(entry: ContextHistoryEntry): void {
    history.push(entry);
    if (history.length > cfg.maxHistoryEntries) {
      history = history.slice(-cfg.maxHistoryEntries);
    }
  }

  function getAverageTokensPerTurn(): number {
    if (turnTokenDeltas.length === 0) {
      return 0;
    }
    const sum = turnTokenDeltas.reduce((a, b) => a + b, 0);
    return sum / turnTokenDeltas.length;
  }

  function getHealth(): ContextHealth {
    const available = Math.max(0, cfg.contextWindowSize - usedTokens);
    const ratio = cfg.contextWindowSize > 0 ? usedTokens / cfg.contextWindowSize : 0;
    const clampedRatio = Math.min(1, Math.max(0, ratio));
    const avg = getAverageTokensPerTurn();
    const estimatedTurns = avg > 0 ? Math.floor(available / avg) : Infinity;
    const status = resolveStatus(clampedRatio, cfg.warningThreshold, cfg.criticalThreshold);
    const pct = Math.round(clampedRatio * 100);

    let statusMessage = `Context: ${formatTokenCount(usedTokens)}/${formatTokenCount(cfg.contextWindowSize)} tokens (${pct}%)`;
    if (status !== "healthy") {
      statusMessage += ` ${STATUS_INDICATORS[status]}`;
    }
    if (Number.isFinite(estimatedTurns)) {
      statusMessage += ` -- ~${estimatedTurns} turns remaining before compaction`;
    }

    return {
      totalTokens: cfg.contextWindowSize,
      usedTokens,
      availableTokens: available,
      utilizationRatio: clampedRatio,
      estimatedTurnsRemaining: estimatedTurns,
      compactionImminent: clampedRatio >= cfg.compactionThreshold - 0.1,
      status,
      statusMessage,
    };
  }

  return {
    recordTurn(tokens: number, event?: ContextHistoryEntry["event"]): void {
      const delta = Math.max(0, tokens);
      usedTokens += delta;
      turnNumber += 1;
      turnTokenDeltas.push(delta);
      pushHistory({
        timestamp: Date.now(),
        usedTokens,
        turnNumber,
        event,
      });
    },

    recordCompaction(tokensFreed: number): void {
      const freed = Math.max(0, tokensFreed);
      usedTokens = Math.max(0, usedTokens - freed);
      pushHistory({
        timestamp: Date.now(),
        usedTokens,
        turnNumber,
        event: "compaction",
      });
    },

    getHealth,
    getHistory: () => [...history],
    getAverageTokensPerTurn,

    formatStatus(): string {
      return getHealth().statusMessage;
    },

    reset(): void {
      usedTokens = 0;
      turnNumber = 0;
      history = [];
      turnTokenDeltas = [];
    },
  };
}
