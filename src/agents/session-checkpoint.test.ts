import { describe, expect, it, beforeEach } from "vitest";
import {
  createCheckpointManager,
  shouldAutoSave,
  type CheckpointManager,
  type CheckpointState,
} from "./session-checkpoint.js";

function makeState(overrides?: Partial<CheckpointState>): CheckpointState {
  return {
    activeTasks: ["Implement auth middleware"],
    recentDecisions: ["Use JWT for auth"],
    toolsUsed: ["file_search", "code_edit"],
    openQuestions: ["Which testing framework?"],
    tokenCount: 12000,
    userPreferences: ["verbose output"],
    summary: "User was building a REST API with authentication.",
    ...overrides,
  };
}

describe("session-checkpoint", () => {
  let mgr: CheckpointManager;

  beforeEach(() => {
    mgr = createCheckpointManager();
  });

  it("saves and retrieves a checkpoint", () => {
    const state = makeState();
    const cp = mgr.save("s1", 50, state);
    expect(cp.id).toBeTruthy();
    expect(cp.sessionId).toBe("s1");
    expect(cp.turnNumber).toBe(50);
    expect(cp.state).toEqual(state);
    expect(cp.timestamp).toBeGreaterThan(0);
  });

  it("getLatest returns the newest checkpoint", () => {
    mgr.save("s1", 50, makeState({ summary: "first" }));
    mgr.save("s1", 100, makeState({ summary: "second" }));
    const latest = mgr.getLatest("s1");
    expect(latest?.turnNumber).toBe(100);
    expect(latest?.state.summary).toBe("second");
  });

  it("getById returns the correct checkpoint", () => {
    const cp1 = mgr.save("s1", 50, makeState());
    const cp2 = mgr.save("s1", 100, makeState());
    expect(mgr.getById(cp1.id)?.turnNumber).toBe(50);
    expect(mgr.getById(cp2.id)?.turnNumber).toBe(100);
  });

  it("getById returns null for unknown ID", () => {
    expect(mgr.getById("nonexistent")).toBeNull();
  });

  it("list returns checkpoints newest first", () => {
    mgr.save("s1", 50, makeState());
    mgr.save("s1", 100, makeState());
    mgr.save("s1", 150, makeState());
    const list = mgr.list("s1");
    expect(list.map((c) => c.turnNumber)).toEqual([150, 100, 50]);
  });

  it("list returns empty array for unknown session", () => {
    expect(mgr.list("unknown")).toEqual([]);
  });

  it("resume returns the checkpoint state", () => {
    const state = makeState({ summary: "resumable" });
    const cp = mgr.save("s1", 50, state);
    const resumed = mgr.resume(cp.id);
    expect(resumed).toEqual(state);
  });

  it("resume returns null for unknown checkpoint", () => {
    expect(mgr.resume("nonexistent")).toBeNull();
  });

  it("prune keeps only N newest checkpoints", () => {
    for (let i = 1; i <= 5; i++) {
      mgr.save("s1", i * 50, makeState());
    }
    const removed = mgr.prune("s1", 2);
    expect(removed).toBe(3);
    const list = mgr.list("s1");
    expect(list).toHaveLength(2);
    expect(list[0].turnNumber).toBe(250);
    expect(list[1].turnNumber).toBe(200);
  });

  it("prune returns 0 when nothing to remove", () => {
    mgr.save("s1", 50, makeState());
    expect(mgr.prune("s1", 5)).toBe(0);
    expect(mgr.prune("unknown", 5)).toBe(0);
  });

  it("auto-prunes when exceeding maxCheckpointsPerSession", () => {
    const m = createCheckpointManager({ maxCheckpointsPerSession: 3 });
    for (let i = 1; i <= 5; i++) {
      m.save("s1", i * 50, makeState());
    }
    expect(m.list("s1")).toHaveLength(3);
    // Oldest should have been removed; newest three remain.
    expect(m.list("s1").map((c) => c.turnNumber)).toEqual([250, 200, 150]);
  });

  it("multiple sessions do not interfere", () => {
    mgr.save("s1", 10, makeState({ summary: "session one" }));
    mgr.save("s2", 20, makeState({ summary: "session two" }));
    expect(mgr.list("s1")).toHaveLength(1);
    expect(mgr.list("s2")).toHaveLength(1);
    expect(mgr.getLatest("s1")?.state.summary).toBe("session one");
    expect(mgr.getLatest("s2")?.state.summary).toBe("session two");
  });

  it("totalCount spans all sessions", () => {
    mgr.save("s1", 10, makeState());
    mgr.save("s1", 20, makeState());
    mgr.save("s2", 30, makeState());
    expect(mgr.totalCount()).toBe(3);
  });

  it("clear removes everything", () => {
    mgr.save("s1", 10, makeState());
    mgr.save("s2", 20, makeState());
    mgr.clear();
    expect(mgr.totalCount()).toBe(0);
    expect(mgr.list("s1")).toEqual([]);
    expect(mgr.getLatest("s1")).toBeNull();
  });

  it("getLatest returns null for missing session", () => {
    expect(mgr.getLatest("missing")).toBeNull();
  });

  it("formatResumePrompt produces expected output", () => {
    const cp = mgr.save("s1", 150, makeState());
    const prompt = mgr.formatResumePrompt(cp);
    expect(prompt).toContain("[Session Resume - Checkpoint from turn #150]");
    expect(prompt).toContain("Summary: User was building a REST API with authentication.");
    expect(prompt).toContain("Active tasks: Implement auth middleware");
    expect(prompt).toContain("Recent decisions: Use JWT for auth");
    expect(prompt).toContain("Open questions: Which testing framework?");
    expect(prompt).toContain("Tools used: file_search, code_edit");
    expect(prompt).toContain("User preferences: verbose output");
    expect(prompt).toContain("Token count: 12000");
  });

  it("formatResumePrompt omits empty sections", () => {
    const cp = mgr.save(
      "s1",
      50,
      makeState({
        activeTasks: [],
        recentDecisions: [],
        openQuestions: [],
        toolsUsed: [],
        userPreferences: [],
      }),
    );
    const prompt = mgr.formatResumePrompt(cp);
    expect(prompt).not.toContain("Active tasks:");
    expect(prompt).not.toContain("Recent decisions:");
    expect(prompt).not.toContain("Open questions:");
    expect(prompt).not.toContain("Tools used:");
    expect(prompt).not.toContain("User preferences:");
    expect(prompt).toContain("Summary:");
    expect(prompt).toContain("Token count:");
  });

  describe("shouldAutoSave", () => {
    it("returns true at interval boundaries", () => {
      expect(shouldAutoSave(50, 50)).toBe(true);
      expect(shouldAutoSave(100, 50)).toBe(true);
      expect(shouldAutoSave(150, 50)).toBe(true);
    });

    it("returns false between intervals", () => {
      expect(shouldAutoSave(49, 50)).toBe(false);
      expect(shouldAutoSave(51, 50)).toBe(false);
      expect(shouldAutoSave(1, 50)).toBe(false);
    });

    it("returns false for zero or negative inputs", () => {
      expect(shouldAutoSave(0, 50)).toBe(false);
      expect(shouldAutoSave(50, 0)).toBe(false);
      expect(shouldAutoSave(-50, 50)).toBe(false);
    });
  });
});
