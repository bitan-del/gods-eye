import { describe, expect, it, beforeEach } from "vitest";
import { createPinnedMemory, type PinnedMemoryStore } from "./pinned-memory.js";

describe("pinned-memory", () => {
  let store: PinnedMemoryStore;

  beforeEach(() => {
    store = createPinnedMemory();
  });

  it("pins a fact and retrieves it", () => {
    const fact = store.pin("Use TypeScript for all new files", {
      category: "decision",
      source: "user",
      priority: 8,
    });
    expect(fact.id).toBeTruthy();
    expect(fact.content).toBe("Use TypeScript for all new files");
    expect(fact.category).toBe("decision");
    expect(fact.source).toBe("user");
    expect(fact.priority).toBe(8);
    expect(fact.createdAt).toBeGreaterThan(0);

    const all = store.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(fact.id);
  });

  it("unpins by ID", () => {
    const fact = store.pin("temporary fact");
    expect(store.count()).toBe(1);
    expect(store.unpin(fact.id)).toBe(true);
    expect(store.count()).toBe(0);
  });

  it("unpins by content substring", () => {
    store.pin("The user prefers dark theme");
    expect(store.count()).toBe(1);
    expect(store.unpin("dark theme")).toBe(true);
    expect(store.count()).toBe(0);
  });

  it("returns false when unpin target not found", () => {
    store.pin("some fact");
    expect(store.unpin("nonexistent")).toBe(false);
    expect(store.count()).toBe(1);
  });

  it("gets all sorted by priority (highest first)", () => {
    store.pin("low priority", { priority: 2 });
    store.pin("high priority", { priority: 9 });
    store.pin("medium priority", { priority: 5 });

    const all = store.getAll();
    expect(all.map((f) => f.priority)).toEqual([9, 5, 2]);
  });

  it("gets by category", () => {
    store.pin("decision A", { category: "decision" });
    store.pin("preference B", { category: "preference" });
    store.pin("decision C", { category: "decision" });

    const decisions = store.getByCategory("decision");
    expect(decisions).toHaveLength(2);
    expect(decisions.every((f) => f.category === "decision")).toBe(true);
  });

  it("searches by keyword in content", () => {
    store.pin("Always use dark theme in examples");
    store.pin("Prefer TypeScript over JavaScript");
    store.pin("Use ESM modules only");

    const results = store.search("typescript");
    expect(results).toHaveLength(1);
    expect(results[0].content).toContain("TypeScript");
  });

  it("searches by keyword in tags", () => {
    store.pin("Some fact", { tags: ["frontend", "styling"] });
    store.pin("Another fact", { tags: ["backend"] });

    const results = store.search("styling");
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe("Some fact");
  });

  it("formats for compaction as markdown block", () => {
    store.pin("User prefers TypeScript", { category: "decision", priority: 8 });
    store.pin("Always use dark theme", { category: "preference", priority: 5 });

    const output = store.formatForCompaction();
    expect(output).toContain("## Pinned Facts (DO NOT REMOVE)");
    expect(output).toContain("[decision] User prefers TypeScript");
    expect(output).toContain("[preference] Always use dark theme");
    // Higher priority should come first
    const decisionIdx = output.indexOf("[decision]");
    const preferenceIdx = output.indexOf("[preference]");
    expect(decisionIdx).toBeLessThan(preferenceIdx);
  });

  it("returns empty string from formatForCompaction when no facts", () => {
    expect(store.formatForCompaction()).toBe("");
  });

  it("formats for prompt with pinned-facts tags", () => {
    store.pin("Use ESM modules", { priority: 7 });
    const output = store.formatForPrompt();
    expect(output).toContain("<pinned-facts>");
    expect(output).toContain("- Use ESM modules");
    expect(output).toContain("</pinned-facts>");
  });

  it("returns empty string from formatForPrompt when no facts", () => {
    expect(store.formatForPrompt()).toBe("");
  });

  it("evicts lowest priority facts when maxPins exceeded", () => {
    const small = createPinnedMemory({ maxPins: 3 });
    small.pin("low", { priority: 1 });
    small.pin("medium", { priority: 5 });
    small.pin("high", { priority: 9 });
    small.pin("very high", { priority: 10 });

    expect(small.count()).toBe(3);
    const all = small.getAll();
    expect(all.map((f) => f.content)).toEqual(["very high", "high", "medium"]);
  });

  it("truncates content exceeding maxContentLength", () => {
    const small = createPinnedMemory({ maxContentLength: 10 });
    const fact = small.pin("this is a long content string");
    expect(fact.content).toBe("this is a ");
    expect(fact.content).toHaveLength(10);
  });

  it("export/import round-trip preserves facts", () => {
    store.pin("Fact A", { category: "decision", priority: 8, tags: ["a"] });
    store.pin("Fact B", { category: "preference", priority: 3 });

    const exported = store.export();
    expect(exported).toHaveLength(2);

    const restored = createPinnedMemory();
    restored.import(exported);
    expect(restored.count()).toBe(2);

    const all = restored.getAll();
    expect(all[0].content).toBe("Fact A");
    expect(all[0].tags).toEqual(["a"]);
    expect(all[1].content).toBe("Fact B");
  });

  it("clears all facts", () => {
    store.pin("A");
    store.pin("B");
    expect(store.count()).toBe(2);
    store.clear();
    expect(store.count()).toBe(0);
    expect(store.getAll()).toEqual([]);
  });

  it("count returns current number of facts", () => {
    expect(store.count()).toBe(0);
    store.pin("one");
    expect(store.count()).toBe(1);
    store.pin("two");
    expect(store.count()).toBe(2);
  });

  it("applies default values for optional fields", () => {
    const fact = store.pin("bare minimum fact");
    expect(fact.category).toBe("custom");
    expect(fact.source).toBe("user");
    expect(fact.priority).toBe(5);
    expect(fact.tags).toBeUndefined();
  });

  it("import truncates content exceeding maxContentLength", () => {
    const small = createPinnedMemory({ maxContentLength: 5 });
    small.import([
      {
        id: "test-id",
        content: "very long content here",
        category: "custom",
        createdAt: Date.now(),
        source: "user",
        priority: 5,
      },
    ]);
    const all = small.getAll();
    expect(all[0].content).toBe("very ");
  });

  it("import respects maxPins and evicts lowest priority", () => {
    const small = createPinnedMemory({ maxPins: 2 });
    small.import([
      { id: "a", content: "low", category: "custom", createdAt: 1, source: "user", priority: 1 },
      { id: "b", content: "high", category: "custom", createdAt: 2, source: "user", priority: 9 },
      { id: "c", content: "mid", category: "custom", createdAt: 3, source: "user", priority: 5 },
    ]);
    expect(small.count()).toBe(2);
    const all = small.getAll();
    expect(all.map((f) => f.content)).toEqual(["high", "mid"]);
  });

  it("unpin by content substring is case-insensitive", () => {
    store.pin("Dark Theme Preference");
    expect(store.unpin("dark theme")).toBe(true);
    expect(store.count()).toBe(0);
  });
});
