/**
 * Pre-built agent configuration templates for common agent roles.
 */

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  systemPrompt: string;
  tools: string[];
  modelTier: "cheap" | "mid" | "expensive";
  autonomyLevel: "supervised" | "semi-autonomous" | "autonomous";
  maxTurns: number;
  budgetConfig: {
    maxTokensPerSession: number;
    maxTokensPerHour: number;
  };
}

export const BUILT_IN_TEMPLATES: AgentTemplate[] = [
  {
    id: "code-reviewer",
    name: "Code Reviewer",
    description:
      "Reviews pull requests and provides actionable feedback on code quality, style, and potential bugs.",
    category: "development",
    systemPrompt:
      "You are a code reviewer. Analyze diffs, identify bugs, suggest improvements, and enforce coding standards. Be concise and actionable.",
    tools: ["git-diff", "file-read", "file-search", "git-log"],
    modelTier: "cheap",
    autonomyLevel: "supervised",
    maxTurns: 10,
    budgetConfig: {
      maxTokensPerSession: 50_000,
      maxTokensPerHour: 100_000,
    },
  },
  {
    id: "research-assistant",
    name: "Research Assistant",
    description:
      "Searches the web, synthesizes information, and produces structured summaries on any topic.",
    category: "research",
    systemPrompt:
      "You are a research assistant. Search the web for relevant sources, cross-reference claims, and produce well-structured summaries with citations.",
    tools: ["web-search", "web-fetch", "file-write", "file-read"],
    modelTier: "mid",
    autonomyLevel: "semi-autonomous",
    maxTurns: 20,
    budgetConfig: {
      maxTokensPerSession: 100_000,
      maxTokensPerHour: 200_000,
    },
  },
  {
    id: "devops-automator",
    name: "DevOps Automator",
    description:
      "Automates shell commands, Docker workflows, and deployment pipelines with safety checks.",
    category: "operations",
    systemPrompt:
      "You are a DevOps automation agent. Execute shell commands, manage Docker containers, and orchestrate deployments. Always confirm destructive operations before proceeding.",
    tools: ["shell-exec", "docker-manage", "file-read", "file-write", "deploy-trigger"],
    modelTier: "expensive",
    autonomyLevel: "supervised",
    maxTurns: 15,
    budgetConfig: {
      maxTokensPerSession: 150_000,
      maxTokensPerHour: 300_000,
    },
  },
  {
    id: "content-writer",
    name: "Content Writer",
    description:
      "Writes blog posts, documentation, and creative content with consistent voice and tone.",
    category: "content",
    systemPrompt:
      "You are a content writer. Produce clear, engaging written content. Match the requested tone and format. Iterate based on feedback.",
    tools: ["file-write", "file-read", "web-search"],
    modelTier: "mid",
    autonomyLevel: "autonomous",
    maxTurns: 25,
    budgetConfig: {
      maxTokensPerSession: 120_000,
      maxTokensPerHour: 250_000,
    },
  },
  {
    id: "data-analyst",
    name: "Data Analyst",
    description: "Reads data files, runs analysis code, and produces insights with visualizations.",
    category: "analysis",
    systemPrompt:
      "You are a data analyst. Read data files, write and execute analysis code, and produce clear insights. Present findings with supporting evidence.",
    tools: ["file-read", "code-exec", "file-write", "file-search"],
    modelTier: "mid",
    autonomyLevel: "semi-autonomous",
    maxTurns: 20,
    budgetConfig: {
      maxTokensPerSession: 100_000,
      maxTokensPerHour: 200_000,
    },
  },
  {
    id: "security-auditor",
    name: "Security Auditor",
    description:
      "Scans codebases for vulnerabilities, reviews configurations, and reports security findings.",
    category: "security",
    systemPrompt:
      "You are a security auditor. Scan source code for vulnerabilities, review configurations for misconfigurations, and produce prioritized security reports.",
    tools: ["file-read", "file-search", "security-scan", "git-log"],
    modelTier: "expensive",
    autonomyLevel: "supervised",
    maxTurns: 15,
    budgetConfig: {
      maxTokensPerSession: 80_000,
      maxTokensPerHour: 150_000,
    },
  },
];

/**
 * Look up a built-in template by id.
 */
export function getTemplate(id: string): AgentTemplate | undefined {
  return BUILT_IN_TEMPLATES.find((t) => t.id === id);
}

/**
 * List templates, optionally filtered by category.
 */
export function listTemplates(category?: string): AgentTemplate[] {
  if (category === undefined) {
    return [...BUILT_IN_TEMPLATES];
  }
  return BUILT_IN_TEMPLATES.filter((t) => t.category === category);
}

/**
 * Return the sorted list of unique categories across all built-in templates.
 */
export function listCategories(): string[] {
  const categories = new Set<string>();
  for (const t of BUILT_IN_TEMPLATES) {
    categories.add(t.category);
  }
  return [...categories].toSorted();
}

/**
 * Create a new template by starting from a built-in template and applying overrides.
 * Throws if the base template id is not found.
 */
export function createFromTemplate(id: string, overrides?: Partial<AgentTemplate>): AgentTemplate {
  const base = getTemplate(id);
  if (!base) {
    throw new Error(`Template "${id}" not found`);
  }
  return {
    ...base,
    ...overrides,
    budgetConfig: {
      ...base.budgetConfig,
      ...overrides?.budgetConfig,
    },
  };
}

/**
 * Validate that a template object has all required fields with correct types.
 */
export function validateTemplate(template: AgentTemplate): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!template.id || typeof template.id !== "string") {
    errors.push("id must be a non-empty string");
  }
  if (!template.name || typeof template.name !== "string") {
    errors.push("name must be a non-empty string");
  }
  if (!template.description || typeof template.description !== "string") {
    errors.push("description must be a non-empty string");
  }
  if (!template.category || typeof template.category !== "string") {
    errors.push("category must be a non-empty string");
  }
  if (!template.systemPrompt || typeof template.systemPrompt !== "string") {
    errors.push("systemPrompt must be a non-empty string");
  }
  if (!Array.isArray(template.tools) || template.tools.length === 0) {
    errors.push("tools must be a non-empty array");
  }

  const validModelTiers = ["cheap", "mid", "expensive"] as const;
  if (!(validModelTiers as readonly string[]).includes(template.modelTier)) {
    errors.push(`modelTier must be one of: ${validModelTiers.join(", ")}`);
  }

  const validAutonomyLevels = ["supervised", "semi-autonomous", "autonomous"] as const;
  if (!(validAutonomyLevels as readonly string[]).includes(template.autonomyLevel)) {
    errors.push(`autonomyLevel must be one of: ${validAutonomyLevels.join(", ")}`);
  }

  if (typeof template.maxTurns !== "number" || template.maxTurns <= 0) {
    errors.push("maxTurns must be a positive number");
  }

  if (!template.budgetConfig || typeof template.budgetConfig !== "object") {
    errors.push("budgetConfig must be an object");
  } else {
    if (
      typeof template.budgetConfig.maxTokensPerSession !== "number" ||
      template.budgetConfig.maxTokensPerSession <= 0
    ) {
      errors.push("budgetConfig.maxTokensPerSession must be a positive number");
    }
    if (
      typeof template.budgetConfig.maxTokensPerHour !== "number" ||
      template.budgetConfig.maxTokensPerHour <= 0
    ) {
      errors.push("budgetConfig.maxTokensPerHour must be a positive number");
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Return a human-readable multi-line description of a built-in template.
 * Throws if the template id is not found.
 */
export function describeTemplate(id: string): string {
  const template = getTemplate(id);
  if (!template) {
    throw new Error(`Template "${id}" not found`);
  }

  const lines = [
    `Name: ${template.name}`,
    `ID: ${template.id}`,
    `Category: ${template.category}`,
    `Description: ${template.description}`,
    `Model Tier: ${template.modelTier}`,
    `Autonomy: ${template.autonomyLevel}`,
    `Max Turns: ${template.maxTurns}`,
    `Tools: ${template.tools.join(", ")}`,
    `Budget: ${template.budgetConfig.maxTokensPerSession} tokens/session, ${template.budgetConfig.maxTokensPerHour} tokens/hour`,
  ];

  return lines.join("\n");
}
