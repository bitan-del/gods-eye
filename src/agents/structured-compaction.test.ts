import { describe, expect, it } from "vitest";
import {
  buildStructuredCompactionPrompt,
  createEmptyCompaction,
  extractCompactionInputs,
  formatCompactionSummary,
  mergeCompaction,
  parseCompaction,
  serializeCompaction,
  validateCompaction,
} from "./structured-compaction.js";
import type { CompactionSection } from "./structured-compaction.js";

describe("structured-compaction", () => {
  // --- createEmptyCompaction ---
  it("creates an empty compaction with all required fields", () => {
    const empty = createEmptyCompaction();
    expect(empty.activeTasks).toEqual([]);
    expect(empty.decisions).toEqual([]);
    expect(empty.pinnedFacts).toEqual([]);
    expect(empty.filesModified).toEqual([]);
    expect(empty.errors).toEqual([]);
    expect(empty.recentContext).toBe("");
    expect(empty.userPreferences).toEqual([]);
    expect(empty.openQuestions).toEqual([]);
  });

  // --- parseCompaction ---
  it("parses valid JSON into a CompactionSection", () => {
    const section = createEmptyCompaction();
    section.recentContext = "User asked about tests.";
    const json = JSON.stringify(section);
    const parsed = parseCompaction(json);
    expect(parsed).toEqual(section);
  });

  it("returns null for invalid JSON", () => {
    expect(parseCompaction("{not json")).toBeNull();
  });

  it("returns null for JSON missing required fields", () => {
    expect(parseCompaction(JSON.stringify({ activeTasks: [] }))).toBeNull();
  });

  // --- serializeCompaction round-trip ---
  it("round-trips through serialize and parse", () => {
    const section = createEmptyCompaction();
    section.pinnedFacts = ["Node 22+", "TypeScript ESM"];
    section.recentContext = "Working on compaction.";
    const json = serializeCompaction(section);
    const parsed = parseCompaction(json);
    expect(parsed).toEqual(section);
  });

  // --- mergeCompaction ---
  describe("mergeCompaction", () => {
    it("adds new tasks and updates existing ones", () => {
      const base = createEmptyCompaction();
      base.activeTasks = [{ task: "Write tests", status: "in_progress" }];

      const merged = mergeCompaction(base, {
        activeTasks: [
          { task: "Write tests", status: "done" },
          { task: "Review PR", status: "in_progress" },
        ],
      });

      expect(merged.activeTasks).toHaveLength(2);
      expect(merged.activeTasks.find((t) => t.task === "Write tests")?.status).toBe("done");
      expect(merged.activeTasks.find((t) => t.task === "Review PR")?.status).toBe("in_progress");
    });

    it("appends decisions without duplicates", () => {
      const base = createEmptyCompaction();
      base.decisions = [{ decision: "Use Vitest" }];

      const merged = mergeCompaction(base, {
        decisions: [{ decision: "Use Vitest" }, { decision: "Use ESM" }],
      });

      expect(merged.decisions).toHaveLength(2);
      expect(merged.decisions[1].decision).toBe("Use ESM");
    });

    it("marks old errors as resolved when not re-raised", () => {
      const base = createEmptyCompaction();
      base.errors = [{ error: "Module not found", resolved: false }];

      const merged = mergeCompaction(base, {
        errors: [{ error: "Type mismatch", resolved: false }],
      });

      expect(merged.errors).toHaveLength(2);
      expect(merged.errors.find((e) => e.error === "Module not found")?.resolved).toBe(true);
      expect(merged.errors.find((e) => e.error === "Type mismatch")?.resolved).toBe(false);
    });

    it("preserves pinned facts and adds new ones", () => {
      const base = createEmptyCompaction();
      base.pinnedFacts = ["Fact A"];

      const merged = mergeCompaction(base, {
        pinnedFacts: ["Fact A", "Fact B"],
      });

      expect(merged.pinnedFacts).toEqual(["Fact A", "Fact B"]);
    });
  });

  // --- buildStructuredCompactionPrompt ---
  it("includes JSON schema description in prompt", () => {
    const prompt = buildStructuredCompactionPrompt();
    expect(prompt).toContain("activeTasks");
    expect(prompt).toContain("decisions");
    expect(prompt).toContain("recentContext");
    expect(prompt).toContain("JSON");
  });

  it("includes pinned facts when provided", () => {
    const prompt = buildStructuredCompactionPrompt(["Node 22+"]);
    expect(prompt).toContain("Node 22+");
    expect(prompt).toContain("pinned facts");
  });

  // --- formatCompactionSummary ---
  it("formats all populated sections as markdown", () => {
    const section: CompactionSection = {
      activeTasks: [{ task: "Build feature", status: "in_progress" }],
      decisions: [{ decision: "Use TypeScript", reason: "Type safety" }],
      pinnedFacts: ["Node 22+"],
      filesModified: [{ path: "src/index.ts", action: "modified" }],
      errors: [{ error: "Missing dep", resolved: false }],
      recentContext: "User asked to create a module.",
      userPreferences: ["Prefer ESM"],
      openQuestions: ["Which test framework?"],
    };
    const summary = formatCompactionSummary(section);
    expect(summary).toContain("## Active Tasks");
    expect(summary).toContain("## Decisions");
    expect(summary).toContain("## Pinned Facts");
    expect(summary).toContain("## Files Modified");
    expect(summary).toContain("## Errors");
    expect(summary).toContain("## Recent Context");
    expect(summary).toContain("## User Preferences");
    expect(summary).toContain("## Open Questions");
  });

  // --- validateCompaction ---
  it("validates a correct section", () => {
    const result = validateCompaction(createEmptyCompaction());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("catches missing required fields", () => {
    const result = validateCompaction({ activeTasks: [] });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes("Missing required field"))).toBe(true);
  });

  it("rejects non-object input", () => {
    const result = validateCompaction("not an object");
    expect(result.valid).toBe(false);
  });

  // --- extractCompactionInputs ---
  it("extracts file paths from turns", () => {
    const result = extractCompactionInputs([
      { role: "assistant", content: "I modified src/agents/compaction.ts and created utils.js." },
    ]);
    const paths = result.filesModified?.map((f) => f.path) ?? [];
    expect(paths).toContain("src/agents/compaction.ts");
    expect(paths).toContain("utils.js");
  });

  it("extracts error messages from turns", () => {
    const result = extractCompactionInputs([
      { role: "tool", content: "Error: Module not found\nsome other output" },
    ]);
    expect(result.errors?.some((e) => e.error.includes("Module not found"))).toBe(true);
  });

  it("detects questions from user turns", () => {
    const result = extractCompactionInputs([
      { role: "user", content: "Should we use Vitest or Jest?" },
    ]);
    expect(result.openQuestions?.some((q) => q.includes("Vitest or Jest"))).toBe(true);
  });

  it("does not detect questions from assistant turns", () => {
    const result = extractCompactionInputs([{ role: "assistant", content: "Should I proceed?" }]);
    expect(result.openQuestions).toEqual([]);
  });
});
