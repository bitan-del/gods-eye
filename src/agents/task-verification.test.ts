import { describe, expect, it } from "vitest";
import {
  checkObjectiveAlignment,
  checkToolResults,
  detectFailurePatterns,
  verifyCompletion,
  type TaskEvidence,
} from "./task-verification.js";

// ---------------------------------------------------------------------------
// detectFailurePatterns
// ---------------------------------------------------------------------------
describe("detectFailurePatterns", () => {
  it("detects stack traces", () => {
    const output = `  at Object.<anonymous> (/app/index.ts:12:5)\n  at Module._compile (node:internal/modules/cjs/loader:1)`;
    const result = detectFailurePatterns(output);
    expect(result.hasError).toBe(true);
    expect(result.patterns).toContain("js-stack-trace");
  });

  it("detects python tracebacks", () => {
    const result = detectFailurePatterns("Traceback (most recent call last):");
    expect(result.hasError).toBe(true);
    expect(result.patterns).toContain("python-traceback");
  });

  it("detects HTTP error codes", () => {
    const result = detectFailurePatterns("Server responded with 503 Service Unavailable");
    expect(result.hasError).toBe(true);
    expect(result.patterns).toContain("http-error-code");
  });

  it("detects TODO markers", () => {
    const result = detectFailurePatterns("TODO: finish implementation");
    expect(result.hasError).toBe(true);
    expect(result.patterns).toContain("todo-marker");
  });

  it("detects FIXME markers", () => {
    const result = detectFailurePatterns("FIXME: this is broken");
    expect(result.hasError).toBe(true);
    expect(result.patterns).toContain("fixme-marker");
  });

  it("detects permission denied", () => {
    const result = detectFailurePatterns("Permission denied: /etc/shadow");
    expect(result.hasError).toBe(true);
    expect(result.patterns).toContain("permission-denied");
  });

  it("detects timeout", () => {
    const result = detectFailurePatterns("Request timeout after 30s");
    expect(result.hasError).toBe(true);
    expect(result.patterns).toContain("timeout");
  });

  it("returns no patterns for clean output", () => {
    const result = detectFailurePatterns("File created successfully at /tmp/out.txt");
    expect(result.hasError).toBe(false);
    expect(result.patterns).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// checkToolResults
// ---------------------------------------------------------------------------
describe("checkToolResults", () => {
  it("reports all succeeded when every tool succeeds", () => {
    const results = [
      { tool: "file_write", success: true, hasOutput: true },
      { tool: "bash", success: true, hasOutput: true },
    ];
    const check = checkToolResults(results);
    expect(check.allSucceeded).toBe(true);
    expect(check.failureCount).toBe(0);
  });

  it("detects failures and collects error patterns", () => {
    const results = [
      { tool: "bash", success: false, hasOutput: false, errorMessage: "Error: not found" },
      { tool: "file_read", success: true, hasOutput: true },
    ];
    const check = checkToolResults(results);
    expect(check.allSucceeded).toBe(false);
    expect(check.failureCount).toBe(1);
    expect(check.errorPatterns).toContain("error-message");
    expect(check.errorPatterns).toContain("not-found");
  });

  it("reports not succeeded for empty results", () => {
    const check = checkToolResults([]);
    expect(check.allSucceeded).toBe(false);
    expect(check.failureCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// checkObjectiveAlignment
// ---------------------------------------------------------------------------
describe("checkObjectiveAlignment", () => {
  it("aligns when tools match the objective verb", () => {
    const result = checkObjectiveAlignment("write a config file", ["file_write", "bash"]);
    expect(result.aligned).toBe(true);
    expect(result.score).toBeGreaterThan(0);
  });

  it("detects mismatch when tools don't match verbs", () => {
    const result = checkObjectiveAlignment("delete all temp data", ["fetch_url", "ping_host"]);
    expect(result.aligned).toBe(false);
    expect(result.score).toBe(0);
  });

  it("returns default score when no verbs recognized", () => {
    const result = checkObjectiveAlignment("deploy the app", ["bash"]);
    expect(result.aligned).toBe(true);
    expect(result.score).toBe(0.5);
  });

  it("returns not aligned for empty inputs", () => {
    expect(checkObjectiveAlignment("", []).aligned).toBe(false);
    expect(checkObjectiveAlignment("write file", []).aligned).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// verifyCompletion
// ---------------------------------------------------------------------------
describe("verifyCompletion", () => {
  const baseEvidence: TaskEvidence = {
    toolResults: [
      { tool: "file_write", success: true, hasOutput: true },
      { tool: "bash", success: true, hasOutput: true },
    ],
    originalObjective: "create a new config file",
    agentClaimedComplete: true,
    totalTurns: 3,
    lastTurnHadAction: true,
  };

  it("accepts a successful completion", () => {
    const result = verifyCompletion(baseEvidence);
    expect(result.verified).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    expect(result.recommendation).toBe("accept");
  });

  it("flags agent claiming done with no actions", () => {
    const result = verifyCompletion({
      ...baseEvidence,
      toolResults: [],
    });
    expect(result.verified).toBe(false);
    expect(result.issues.some((i) => i.code === "NO_ACTIONS")).toBe(true);
    expect(result.recommendation).not.toBe("accept");
  });

  it("detects failed tool results and recommends retry", () => {
    const result = verifyCompletion({
      ...baseEvidence,
      toolResults: [
        { tool: "bash", success: false, hasOutput: false, errorMessage: "Error: FAILED" },
        { tool: "bash", success: false, hasOutput: false, errorMessage: "Permission denied" },
      ],
    });
    expect(result.verified).toBe(false);
    expect(result.issues.some((i) => i.code === "TOOL_FAILURES")).toBe(true);
    expect(result.recommendation).toBe("retry");
  });

  it("detects partial completion with empty outputs", () => {
    const result = verifyCompletion({
      ...baseEvidence,
      toolResults: [
        { tool: "file_write", success: true, hasOutput: false },
        { tool: "bash", success: true, hasOutput: true },
      ],
    });
    expect(result.issues.some((i) => i.code === "EMPTY_OUTPUT")).toBe(true);
  });

  it("detects objective mismatch", () => {
    const result = verifyCompletion({
      ...baseEvidence,
      originalObjective: "delete all temp files",
      toolResults: [{ tool: "file_read", success: true, hasOutput: true }],
    });
    expect(result.issues.some((i) => i.code === "OBJECTIVE_MISMATCH")).toBe(true);
  });

  it("escalates on multiple critical issues", () => {
    const result = verifyCompletion({
      toolResults: [],
      originalObjective: "write and test the module",
      agentClaimedComplete: true,
      totalTurns: 1,
      lastTurnHadAction: false,
    });
    // NO_ACTIONS is critical; low confidence triggers escalate path.
    expect(result.verified).toBe(false);
    expect(result.recommendation === "retry" || result.recommendation === "escalate").toBe(true);
  });

  it("accepts with warnings when tools succeeded but had some issues", () => {
    const result = verifyCompletion({
      ...baseEvidence,
      toolResults: [
        { tool: "file_write", success: true, hasOutput: false },
        { tool: "bash", success: true, hasOutput: true },
      ],
    });
    // Should still be accepted since tools succeeded.
    expect(result.recommendation).toBe("accept");
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("flags idle last turn", () => {
    const result = verifyCompletion({
      ...baseEvidence,
      lastTurnHadAction: false,
    });
    expect(result.issues.some((i) => i.code === "IDLE_LAST_TURN")).toBe(true);
  });

  it("detects error patterns in tool error messages", () => {
    const result = verifyCompletion({
      ...baseEvidence,
      toolResults: [
        {
          tool: "bash",
          success: false,
          hasOutput: false,
          errorMessage: "  at runMain (/app/index.ts:10:3)\nError: something broke",
        },
      ],
    });
    expect(result.issues.some((i) => i.code === "ERROR_PATTERNS")).toBe(true);
  });

  it("clamps confidence between 0 and 1", () => {
    // Stack many issues to drive confidence below 0.
    const result = verifyCompletion({
      toolResults: [],
      originalObjective: "write and delete and test everything",
      agentClaimedComplete: true,
      totalTurns: 5,
      lastTurnHadAction: false,
    });
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
