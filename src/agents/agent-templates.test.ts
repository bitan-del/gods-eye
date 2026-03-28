import { describe, expect, it } from "vitest";
import {
  type AgentTemplate,
  BUILT_IN_TEMPLATES,
  createFromTemplate,
  describeTemplate,
  getTemplate,
  listCategories,
  listTemplates,
  validateTemplate,
} from "./agent-templates.js";

describe("BUILT_IN_TEMPLATES", () => {
  it("contains exactly 6 templates", () => {
    expect(BUILT_IN_TEMPLATES).toHaveLength(6);
  });

  it.each([
    "code-reviewer",
    "research-assistant",
    "devops-automator",
    "content-writer",
    "data-analyst",
    "security-auditor",
  ])("includes the %s template", (id) => {
    expect(BUILT_IN_TEMPLATES.find((t) => t.id === id)).toBeDefined();
  });

  it("all built-in templates pass validation", () => {
    for (const template of BUILT_IN_TEMPLATES) {
      const result = validateTemplate(template);
      expect(result, `template "${template.id}" should be valid`).toEqual({
        valid: true,
        errors: [],
      });
    }
  });

  it("every template has a unique id", () => {
    const ids = BUILT_IN_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("getTemplate", () => {
  it("returns a template when the id exists", () => {
    const template = getTemplate("code-reviewer");
    expect(template).toBeDefined();
    expect(template!.id).toBe("code-reviewer");
    expect(template!.name).toBe("Code Reviewer");
  });

  it("returns undefined when the id does not exist", () => {
    expect(getTemplate("nonexistent-id")).toBeUndefined();
  });

  it("returns undefined for an empty string id", () => {
    expect(getTemplate("")).toBeUndefined();
  });
});

describe("listTemplates", () => {
  it("returns all templates when no category is provided", () => {
    const all = listTemplates();
    expect(all).toHaveLength(BUILT_IN_TEMPLATES.length);
  });

  it("returns a new array instance (not the original)", () => {
    const all = listTemplates();
    expect(all).not.toBe(BUILT_IN_TEMPLATES);
  });

  it("filters templates by category", () => {
    const development = listTemplates("development");
    expect(development).toHaveLength(1);
    expect(development[0].id).toBe("code-reviewer");
  });

  it("returns an empty array for an unknown category", () => {
    expect(listTemplates("unknown-category")).toEqual([]);
  });
});

describe("listCategories", () => {
  it("returns unique categories", () => {
    const categories = listCategories();
    expect(new Set(categories).size).toBe(categories.length);
  });

  it("returns categories in sorted order", () => {
    const categories = listCategories();
    const sorted = [...categories].toSorted();
    expect(categories).toEqual(sorted);
  });

  it("includes all expected categories", () => {
    const categories = listCategories();
    for (const expected of [
      "analysis",
      "content",
      "development",
      "operations",
      "research",
      "security",
    ]) {
      expect(categories).toContain(expected);
    }
  });
});

describe("createFromTemplate", () => {
  it("creates a copy of the base template with no overrides", () => {
    const created = createFromTemplate("code-reviewer");
    const base = getTemplate("code-reviewer")!;
    expect(created).toEqual(base);
    expect(created).not.toBe(base);
  });

  it("applies simple overrides", () => {
    const created = createFromTemplate("code-reviewer", {
      name: "Custom Reviewer",
      maxTurns: 50,
    });
    expect(created.name).toBe("Custom Reviewer");
    expect(created.maxTurns).toBe(50);
    // unchanged fields preserved
    expect(created.id).toBe("code-reviewer");
    expect(created.modelTier).toBe("cheap");
  });

  it("deep merges budgetConfig overrides", () => {
    const created = createFromTemplate("data-analyst", {
      budgetConfig: { maxTokensPerSession: 999 } as AgentTemplate["budgetConfig"],
    });
    // overridden field
    expect(created.budgetConfig.maxTokensPerSession).toBe(999);
    // preserved field from base
    const base = getTemplate("data-analyst")!;
    expect(created.budgetConfig.maxTokensPerHour).toBe(base.budgetConfig.maxTokensPerHour);
  });

  it("throws for an unknown template id", () => {
    expect(() => createFromTemplate("does-not-exist")).toThrow(
      'Template "does-not-exist" not found',
    );
  });
});

describe("validateTemplate", () => {
  function makeValid(): AgentTemplate {
    return {
      id: "test",
      name: "Test",
      description: "A test template",
      category: "testing",
      systemPrompt: "You are a test agent.",
      tools: ["tool-a"],
      modelTier: "mid",
      autonomyLevel: "supervised",
      maxTurns: 5,
      budgetConfig: {
        maxTokensPerSession: 1000,
        maxTokensPerHour: 2000,
      },
    };
  }

  it("accepts a valid template", () => {
    expect(validateTemplate(makeValid())).toEqual({ valid: true, errors: [] });
  });

  it("rejects empty id", () => {
    const t = makeValid();
    t.id = "";
    const result = validateTemplate(t);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("id must be a non-empty string");
  });

  it("rejects empty tools array", () => {
    const t = makeValid();
    t.tools = [];
    const result = validateTemplate(t);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("tools must be a non-empty array");
  });

  it("rejects invalid modelTier", () => {
    const t = makeValid();
    (t as unknown as Record<string, unknown>).modelTier = "ultra";
    const result = validateTemplate(t as unknown as AgentTemplate);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("modelTier"))).toBe(true);
  });

  it("rejects invalid autonomyLevel", () => {
    const t = makeValid();
    (t as unknown as Record<string, unknown>).autonomyLevel = "rogue";
    const result = validateTemplate(t as unknown as AgentTemplate);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("autonomyLevel"))).toBe(true);
  });

  it("rejects zero maxTurns", () => {
    const t = makeValid();
    t.maxTurns = 0;
    const result = validateTemplate(t);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("maxTurns must be a positive number");
  });

  it("rejects negative maxTokensPerSession", () => {
    const t = makeValid();
    t.budgetConfig.maxTokensPerSession = -1;
    const result = validateTemplate(t);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("maxTokensPerSession"))).toBe(true);
  });

  it("collects multiple errors at once", () => {
    const t = makeValid();
    t.id = "";
    t.name = "";
    t.tools = [];
    const result = validateTemplate(t);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe("describeTemplate", () => {
  it("returns a multi-line string for a valid template", () => {
    const desc = describeTemplate("code-reviewer");
    const lines = desc.split("\n");
    expect(lines.length).toBeGreaterThanOrEqual(5);
  });

  it("includes the template name and id", () => {
    const desc = describeTemplate("research-assistant");
    expect(desc).toContain("Name: Research Assistant");
    expect(desc).toContain("ID: research-assistant");
  });

  it("includes budget information", () => {
    const desc = describeTemplate("devops-automator");
    expect(desc).toContain("tokens/session");
    expect(desc).toContain("tokens/hour");
  });

  it("includes tools list", () => {
    const desc = describeTemplate("security-auditor");
    const base = getTemplate("security-auditor")!;
    for (const tool of base.tools) {
      expect(desc).toContain(tool);
    }
  });

  it("throws for an unknown template id", () => {
    expect(() => describeTemplate("nope")).toThrow('Template "nope" not found');
  });
});
