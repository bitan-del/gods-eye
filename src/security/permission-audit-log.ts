import { randomUUID } from "node:crypto";

export interface AuditEntry {
  id: string;
  timestamp: number;
  // Layer 1: Identity
  agentId: string;
  sessionId: string;
  initiator: "human" | "agent" | "sub-agent" | "system";
  // Layer 2: Input
  input?: string;
  // Layer 3: Reasoning
  reasoning?: string;
  // Layer 4: Execution
  action: "tool_call" | "file_access" | "shell_command" | "api_request" | "config_change";
  toolName?: string;
  args?: Record<string, unknown>;
  filePath?: string;
  // Layer 5: Outcome
  outcome: "success" | "failure" | "blocked" | "approval_pending";
  resultSummary?: string;
  error?: string;
  // Metadata
  durationMs?: number;
  tokensUsed?: number;
}

export interface AuditLogConfig {
  maxEntries: number;
  redactPatterns: RegExp[];
  truncateLength: number;
}

export interface AuditLog {
  log(entry: Omit<AuditEntry, "id" | "timestamp">): AuditEntry;
  query(
    filter: Partial<Pick<AuditEntry, "agentId" | "sessionId" | "action" | "outcome">>,
  ): AuditEntry[];
  getRange(startMs: number, endMs: number): AuditEntry[];
  recent(count: number): AuditEntry[];
  summary(): Record<
    AuditEntry["action"],
    { total: number; succeeded: number; failed: number; blocked: number }
  >;
  formatReport(filter?: { sessionId?: string; agentId?: string }): string;
  export(): AuditEntry[];
  count(): number;
  clear(): void;
}

/** Default redaction patterns (API keys, tokens, passwords). */
export const DEFAULT_REDACT_PATTERNS: RegExp[] = [
  /^sk-[A-Za-z0-9_-]+/,
  /^ghp_[A-Za-z0-9]+/,
  /^Bearer\s+.+/i,
  /^gho_[A-Za-z0-9]+/,
  /^xox[bpas]-[A-Za-z0-9-]+/,
];

/** Keys whose values are always redacted regardless of pattern match. */
const SENSITIVE_KEYS = new Set(["password", "token", "secret", "key", "apikey", "api_key"]);

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key.toLowerCase());
}

/** Redact sensitive values from an args object. */
export function redactArgs(
  args: Record<string, unknown>,
  patterns: RegExp[] = DEFAULT_REDACT_PATTERNS,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (isSensitiveKey(key)) {
      result[key] = "[REDACTED]";
      continue;
    }
    if (typeof value === "string") {
      const matched = patterns.some((p) => p.test(value));
      result[key] = matched ? "[REDACTED]" : value;
      continue;
    }
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      result[key] = redactArgs(value as Record<string, unknown>, patterns);
      continue;
    }
    result[key] = value;
  }
  return result;
}

function truncate(str: string | undefined, maxLen: number): string | undefined {
  if (str === undefined) {
    return undefined;
  }
  return str.length > maxLen ? str.slice(0, maxLen) + "..." : str;
}

function padOutcome(outcome: string): string {
  return outcome.toUpperCase();
}

function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const ALL_ACTIONS: AuditEntry["action"][] = [
  "tool_call",
  "file_access",
  "shell_command",
  "api_request",
  "config_change",
];

/** Create an audit log instance. */
export function createAuditLog(config?: Partial<AuditLogConfig>): AuditLog {
  const maxEntries = config?.maxEntries ?? 10_000;
  const redactPatterns = config?.redactPatterns ?? DEFAULT_REDACT_PATTERNS;
  const truncateLength = config?.truncateLength ?? 200;
  const entries: AuditEntry[] = [];

  return {
    log(partial) {
      const entry: AuditEntry = {
        ...partial,
        id: randomUUID(),
        timestamp: Date.now(),
        input: truncate(partial.input, truncateLength),
        resultSummary: truncate(partial.resultSummary, truncateLength),
        args: partial.args ? redactArgs(partial.args, redactPatterns) : undefined,
      };
      // LRU eviction: drop oldest when at capacity.
      if (entries.length >= maxEntries) {
        entries.shift();
      }
      entries.push(entry);
      return entry;
    },

    query(filter) {
      return entries.filter((e) => {
        if (filter.agentId !== undefined && e.agentId !== filter.agentId) {
          return false;
        }
        if (filter.sessionId !== undefined && e.sessionId !== filter.sessionId) {
          return false;
        }
        if (filter.action !== undefined && e.action !== filter.action) {
          return false;
        }
        if (filter.outcome !== undefined && e.outcome !== filter.outcome) {
          return false;
        }
        return true;
      });
    },

    getRange(startMs, endMs) {
      return entries.filter((e) => e.timestamp >= startMs && e.timestamp <= endMs);
    },

    recent(count) {
      return entries.slice(-count).toReversed();
    },

    summary() {
      const result = {} as Record<
        AuditEntry["action"],
        { total: number; succeeded: number; failed: number; blocked: number }
      >;
      for (const action of ALL_ACTIONS) {
        result[action] = { total: 0, succeeded: 0, failed: 0, blocked: 0 };
      }
      for (const e of entries) {
        const bucket = result[e.action];
        bucket.total++;
        if (e.outcome === "success") {
          bucket.succeeded++;
        } else if (e.outcome === "failure") {
          bucket.failed++;
        } else if (e.outcome === "blocked") {
          bucket.blocked++;
        }
      }
      return result;
    },

    formatReport(filter) {
      let subset = entries;
      if (filter?.sessionId) {
        subset = subset.filter((e) => e.sessionId === filter.sessionId);
      }
      if (filter?.agentId) {
        subset = subset.filter((e) => e.agentId === filter.agentId);
      }
      return subset
        .map((e) => {
          const ts = formatTimestamp(e.timestamp);
          const detail = e.toolName ?? e.filePath ?? e.input ?? "";
          return `[${ts}] ${e.agentId} | ${e.action} | ${detail} | ${padOutcome(e.outcome)}`;
        })
        .join("\n");
    },

    export() {
      return [...entries];
    },

    count() {
      return entries.length;
    },

    clear() {
      entries.length = 0;
    },
  };
}
