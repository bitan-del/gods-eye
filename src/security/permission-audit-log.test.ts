import { describe, expect, it, beforeEach } from "vitest";
import { createAuditLog, redactArgs, DEFAULT_REDACT_PATTERNS } from "./permission-audit-log.js";
import type { AuditLog } from "./permission-audit-log.js";

describe("permission-audit-log", () => {
  let log: AuditLog;

  beforeEach(() => {
    log = createAuditLog();
  });

  const baseEntry = {
    agentId: "agent-1",
    sessionId: "sess-1",
    initiator: "agent" as const,
    action: "tool_call" as const,
    toolName: "file_read",
    outcome: "success" as const,
  };

  it("logs an entry and retrieves it", () => {
    const entry = log.log(baseEntry);
    expect(log.count()).toBe(1);
    const all = log.export();
    expect(all).toHaveLength(1);
    expect(all[0]).toBe(entry);
  });

  it("auto-generates id and timestamp", () => {
    const entry = log.log(baseEntry);
    expect(entry.id).toBeTruthy();
    expect(typeof entry.id).toBe("string");
    expect(entry.timestamp).toBeGreaterThan(0);
    // UUID v4 format
    expect(entry.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
  });

  it("queries by agentId", () => {
    log.log(baseEntry);
    log.log({ ...baseEntry, agentId: "agent-2" });
    expect(log.query({ agentId: "agent-1" })).toHaveLength(1);
    expect(log.query({ agentId: "agent-2" })).toHaveLength(1);
    expect(log.query({ agentId: "agent-3" })).toHaveLength(0);
  });

  it("queries by sessionId", () => {
    log.log(baseEntry);
    log.log({ ...baseEntry, sessionId: "sess-2" });
    expect(log.query({ sessionId: "sess-1" })).toHaveLength(1);
  });

  it("queries by action", () => {
    log.log(baseEntry);
    log.log({ ...baseEntry, action: "shell_command" });
    expect(log.query({ action: "tool_call" })).toHaveLength(1);
    expect(log.query({ action: "shell_command" })).toHaveLength(1);
  });

  it("queries by outcome", () => {
    log.log(baseEntry);
    log.log({ ...baseEntry, outcome: "blocked" });
    expect(log.query({ outcome: "success" })).toHaveLength(1);
    expect(log.query({ outcome: "blocked" })).toHaveLength(1);
  });

  it("queries with multiple filters", () => {
    log.log(baseEntry);
    log.log({ ...baseEntry, agentId: "agent-2" });
    log.log({ ...baseEntry, outcome: "failure" });
    const results = log.query({ agentId: "agent-1", outcome: "success" });
    expect(results).toHaveLength(1);
  });

  it("gets entries within a time range", () => {
    const before = Date.now();
    log.log(baseEntry);
    const after = Date.now();
    expect(log.getRange(before, after)).toHaveLength(1);
    expect(log.getRange(after + 1, after + 100)).toHaveLength(0);
  });

  it("returns recent N entries newest first", () => {
    log.log({ ...baseEntry, toolName: "first" });
    log.log({ ...baseEntry, toolName: "second" });
    log.log({ ...baseEntry, toolName: "third" });
    const recent = log.recent(2);
    expect(recent).toHaveLength(2);
    expect(recent[0].toolName).toBe("third");
    expect(recent[1].toolName).toBe("second");
  });

  it("computes summary aggregation", () => {
    log.log(baseEntry);
    log.log({ ...baseEntry, outcome: "failure" });
    log.log({ ...baseEntry, outcome: "blocked" });
    log.log({ ...baseEntry, action: "shell_command", outcome: "success" });
    const s = log.summary();
    expect(s.tool_call.total).toBe(3);
    expect(s.tool_call.succeeded).toBe(1);
    expect(s.tool_call.failed).toBe(1);
    expect(s.tool_call.blocked).toBe(1);
    expect(s.shell_command.total).toBe(1);
    expect(s.shell_command.succeeded).toBe(1);
    expect(s.file_access.total).toBe(0);
  });

  it("redacts API keys in args (sk-*)", () => {
    const entry = log.log({
      ...baseEntry,
      args: { apiKey: "sk-abc123xyz", other: "safe" },
    });
    expect(entry.args!.apiKey).toBe("[REDACTED]");
    expect(entry.args!.other).toBe("safe");
  });

  it("redacts Bearer tokens in args", () => {
    const entry = log.log({
      ...baseEntry,
      args: { authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.test" },
    });
    expect(entry.args!.authorization).toBe("[REDACTED]");
  });

  it("redacts password fields by key name", () => {
    const entry = log.log({
      ...baseEntry,
      args: { password: "super-secret-123", username: "admin" },
    });
    expect(entry.args!.password).toBe("[REDACTED]");
    expect(entry.args!.username).toBe("admin");
  });

  it("redacts token/secret/key fields by key name", () => {
    const entry = log.log({
      ...baseEntry,
      args: { token: "abc", secret: "def", key: "ghi", name: "safe" },
    });
    expect(entry.args!.token).toBe("[REDACTED]");
    expect(entry.args!.secret).toBe("[REDACTED]");
    expect(entry.args!.key).toBe("[REDACTED]");
    expect(entry.args!.name).toBe("safe");
  });

  it("truncates long input", () => {
    const longInput = "x".repeat(500);
    const entry = log.log({ ...baseEntry, input: longInput });
    expect(entry.input!.length).toBeLessThan(500);
    expect(entry.input!.endsWith("...")).toBe(true);
  });

  it("truncates long resultSummary", () => {
    const longResult = "r".repeat(500);
    const entry = log.log({ ...baseEntry, resultSummary: longResult });
    expect(entry.resultSummary!.length).toBeLessThan(500);
    expect(entry.resultSummary!.endsWith("...")).toBe(true);
  });

  it("evicts oldest entries when maxEntries exceeded", () => {
    const small = createAuditLog({ maxEntries: 3 });
    small.log({ ...baseEntry, toolName: "a" });
    small.log({ ...baseEntry, toolName: "b" });
    small.log({ ...baseEntry, toolName: "c" });
    small.log({ ...baseEntry, toolName: "d" });
    expect(small.count()).toBe(3);
    const all = small.export();
    expect(all[0].toolName).toBe("b");
    expect(all[2].toolName).toBe("d");
  });

  it("formats report output", () => {
    log.log({ ...baseEntry, toolName: "file_read", filePath: "/src/app.ts" });
    log.log({
      ...baseEntry,
      action: "shell_command",
      toolName: "bash",
      outcome: "blocked",
    });
    const report = log.formatReport();
    expect(report).toContain("agent-1");
    expect(report).toContain("tool_call");
    expect(report).toContain("shell_command");
    expect(report).toContain("SUCCESS");
    expect(report).toContain("BLOCKED");
  });

  it("formats report with filter", () => {
    log.log(baseEntry);
    log.log({ ...baseEntry, sessionId: "sess-other" });
    const report = log.formatReport({ sessionId: "sess-1" });
    const lines = report.split("\n").filter(Boolean);
    expect(lines).toHaveLength(1);
  });

  it("exports all entries as a copy", () => {
    log.log(baseEntry);
    const exported = log.export();
    expect(exported).toHaveLength(1);
    // Verify it is a copy
    exported.pop();
    expect(log.count()).toBe(1);
  });

  it("clears the log", () => {
    log.log(baseEntry);
    log.log(baseEntry);
    expect(log.count()).toBe(2);
    log.clear();
    expect(log.count()).toBe(0);
    expect(log.export()).toHaveLength(0);
  });
});

describe("redactArgs standalone", () => {
  it("redacts ghp_ tokens", () => {
    const result = redactArgs({ auth: "ghp_abc123def456" });
    expect(result.auth).toBe("[REDACTED]");
  });

  it("handles nested objects", () => {
    const result = redactArgs({ nested: { password: "secret" } });
    expect((result.nested as Record<string, unknown>).password).toBe("[REDACTED]");
  });

  it("passes through non-sensitive values", () => {
    const result = redactArgs({ name: "test", count: 42, flag: true });
    expect(result.name).toBe("test");
    expect(result.count).toBe(42);
    expect(result.flag).toBe(true);
  });

  it("uses custom patterns when provided", () => {
    const custom = [/^CUSTOM_/];
    const result = redactArgs({ val: "CUSTOM_secret" }, custom);
    expect(result.val).toBe("[REDACTED]");
  });

  it("exports DEFAULT_REDACT_PATTERNS", () => {
    expect(DEFAULT_REDACT_PATTERNS).toBeInstanceOf(Array);
    expect(DEFAULT_REDACT_PATTERNS.length).toBeGreaterThan(0);
  });
});
