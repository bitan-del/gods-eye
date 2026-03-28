import { describe, expect, it } from "vitest";
import {
  TUTORIAL_STEPS,
  advanceStep,
  createTutorialProgress,
  formatProgressBar,
  formatStepDisplay,
  getCompletionPercentage,
  getCurrentStep,
  isTutorialComplete,
  resetTutorial,
  skipStep,
} from "./tutorial.js";

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

describe("TUTORIAL_STEPS", () => {
  it("contains all seven expected step ids in order", () => {
    const ids = TUTORIAL_STEPS.map((s) => s.id);
    expect(ids).toEqual([
      "welcome",
      "configure-provider",
      "test-connection",
      "first-message",
      "explore-tools",
      "setup-channel",
      "congratulations",
    ]);
  });

  it("each step has the required fields", () => {
    for (const step of TUTORIAL_STEPS) {
      expect(typeof step.id).toBe("string");
      expect(step.id.length).toBeGreaterThan(0);
      expect(typeof step.title).toBe("string");
      expect(step.title.length).toBeGreaterThan(0);
      expect(typeof step.description).toBe("string");
      expect(step.description.length).toBeGreaterThan(0);
      expect(typeof step.action).toBe("string");
      expect(step.action.length).toBeGreaterThan(0);
      expect(typeof step.skippable).toBe("boolean");
    }
  });

  it("has unique ids", () => {
    const ids = TUTORIAL_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("setup-channel is the only skippable step", () => {
    const skippable = TUTORIAL_STEPS.filter((s) => s.skippable);
    expect(skippable).toHaveLength(1);
    expect(skippable[0].id).toBe("setup-channel");
  });
});

// ---------------------------------------------------------------------------
// Progress creation
// ---------------------------------------------------------------------------

describe("createTutorialProgress", () => {
  it("returns progress starting at the first step", () => {
    const p = createTutorialProgress();
    expect(p.currentStep).toBe("welcome");
    expect(p.completedSteps).toEqual([]);
  });

  it("sets startedAt and lastResumedAt to roughly now", () => {
    const before = Date.now();
    const p = createTutorialProgress();
    const after = Date.now();
    expect(p.startedAt).toBeGreaterThanOrEqual(before);
    expect(p.startedAt).toBeLessThanOrEqual(after);
    expect(p.lastResumedAt).toBeGreaterThanOrEqual(before);
    expect(p.lastResumedAt).toBeLessThanOrEqual(after);
  });
});

// ---------------------------------------------------------------------------
// Step advancement
// ---------------------------------------------------------------------------

describe("advanceStep", () => {
  it("moves from the first step to the second", () => {
    const p = advanceStep(createTutorialProgress());
    expect(p.currentStep).toBe("configure-provider");
    expect(p.completedSteps).toContain("welcome");
  });

  it("advances sequentially through all steps", () => {
    let p = createTutorialProgress();
    for (let i = 0; i < TUTORIAL_STEPS.length - 1; i++) {
      p = advanceStep(p);
      expect(p.currentStep).toBe(TUTORIAL_STEPS[i + 1].id);
    }
  });

  it("stays on the last step when already there", () => {
    let p = createTutorialProgress();
    for (let i = 0; i < TUTORIAL_STEPS.length; i++) {
      p = advanceStep(p);
    }
    // Should not crash — still on last step and it is completed
    expect(p.currentStep).toBe("congratulations");
    expect(p.completedSteps).toContain("congratulations");
  });

  it("does not duplicate completed step ids", () => {
    let p = createTutorialProgress();
    p = advanceStep(p); // welcome -> configure-provider
    p = advanceStep(p); // configure-provider -> test-connection
    // Manually set back to a completed step and advance again
    const patched: typeof p = { ...p, currentStep: "welcome" };
    const advanced = advanceStep(patched);
    const welcomeCount = advanced.completedSteps.filter((id) => id === "welcome").length;
    expect(welcomeCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Step skipping
// ---------------------------------------------------------------------------

describe("skipStep", () => {
  it("skips a skippable step", () => {
    // Navigate to setup-channel
    let p = createTutorialProgress();
    for (let i = 0; i < 5; i++) {
      p = advanceStep(p);
    }
    expect(p.currentStep).toBe("setup-channel");
    const skipped = skipStep(p);
    expect(skipped.currentStep).toBe("congratulations");
    expect(skipped.completedSteps).toContain("setup-channel");
  });

  it("does nothing for a non-skippable step", () => {
    const p = createTutorialProgress();
    expect(p.currentStep).toBe("welcome");
    const result = skipStep(p);
    expect(result.currentStep).toBe("welcome");
    expect(result.completedSteps).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

describe("resetTutorial", () => {
  it("returns a fresh progress identical to createTutorialProgress", () => {
    const fresh = resetTutorial();
    expect(fresh.currentStep).toBe("welcome");
    expect(fresh.completedSteps).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getCurrentStep
// ---------------------------------------------------------------------------

describe("getCurrentStep", () => {
  it("returns the first step for fresh progress", () => {
    const step = getCurrentStep(createTutorialProgress());
    expect(step).toBeDefined();
    expect(step!.id).toBe("welcome");
  });

  it("returns undefined for an unknown step id", () => {
    const p = createTutorialProgress();
    const bogus = { ...p, currentStep: "nonexistent" };
    expect(getCurrentStep(bogus)).toBeUndefined();
  });

  it("returns the correct step after several advances", () => {
    let p = createTutorialProgress();
    p = advanceStep(p);
    p = advanceStep(p);
    const step = getCurrentStep(p);
    expect(step).toBeDefined();
    expect(step!.id).toBe("test-connection");
  });
});

// ---------------------------------------------------------------------------
// Completion percentage
// ---------------------------------------------------------------------------

describe("getCompletionPercentage", () => {
  it("returns 0 for a brand-new tutorial", () => {
    expect(getCompletionPercentage(createTutorialProgress())).toBe(0);
  });

  it("returns 100 when all steps are completed", () => {
    let p = createTutorialProgress();
    for (let i = 0; i < TUTORIAL_STEPS.length; i++) {
      p = advanceStep(p);
    }
    expect(getCompletionPercentage(p)).toBe(100);
  });

  it("returns an intermediate value mid-way", () => {
    let p = createTutorialProgress();
    p = advanceStep(p); // 1 of 7 completed
    const pct = getCompletionPercentage(p);
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThan(100);
  });
});

// ---------------------------------------------------------------------------
// Progress bar formatting
// ---------------------------------------------------------------------------

describe("formatProgressBar", () => {
  it("shows 0 completed for fresh progress", () => {
    const bar = formatProgressBar(createTutorialProgress());
    expect(bar).toContain("0/7");
    expect(bar).toContain("0%");
  });

  it("shows full bar when complete", () => {
    let p = createTutorialProgress();
    for (let i = 0; i < TUTORIAL_STEPS.length; i++) {
      p = advanceStep(p);
    }
    const bar = formatProgressBar(p);
    expect(bar).toContain("7/7");
    expect(bar).toContain("100%");
    expect(bar).not.toContain("-");
  });

  it("uses # for filled and - for empty segments", () => {
    const bar = formatProgressBar(createTutorialProgress());
    expect(bar).toMatch(/\[#{0,20}-{0,20}\]/);
  });
});

// ---------------------------------------------------------------------------
// Step display formatting
// ---------------------------------------------------------------------------

describe("formatStepDisplay", () => {
  it("includes step number, total, title, and action", () => {
    const step = TUTORIAL_STEPS[0];
    const display = formatStepDisplay(step, 1, 7);
    expect(display).toContain("[Step 1/7]");
    expect(display).toContain(step.title);
    expect(display).toContain(step.action);
  });

  it("marks optional steps", () => {
    const optional = TUTORIAL_STEPS.find((s) => s.skippable)!;
    const display = formatStepDisplay(optional, 6, 7);
    expect(display).toContain("(optional)");
  });

  it("does not mark required steps as optional", () => {
    const required = TUTORIAL_STEPS[0];
    const display = formatStepDisplay(required, 1, 7);
    expect(display).not.toContain("(optional)");
  });
});

// ---------------------------------------------------------------------------
// Tutorial completion detection
// ---------------------------------------------------------------------------

describe("isTutorialComplete", () => {
  it("returns false for fresh progress", () => {
    expect(isTutorialComplete(createTutorialProgress())).toBe(false);
  });

  it("returns false when only some steps are done", () => {
    let p = createTutorialProgress();
    p = advanceStep(p);
    p = advanceStep(p);
    expect(isTutorialComplete(p)).toBe(false);
  });

  it("returns true when every step is completed", () => {
    let p = createTutorialProgress();
    for (let i = 0; i < TUTORIAL_STEPS.length; i++) {
      p = advanceStep(p);
    }
    expect(isTutorialComplete(p)).toBe(true);
  });
});
