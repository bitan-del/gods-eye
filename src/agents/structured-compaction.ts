/** Structured compaction: typed JSON sections for anchored iterative merging. */

export interface CompactionSection {
  activeTasks: Array<{ task: string; status: "in_progress" | "blocked" | "done"; detail?: string }>;
  decisions: Array<{ decision: string; reason?: string; timestamp?: number }>;
  pinnedFacts: string[];
  filesModified: Array<{ path: string; action: "created" | "modified" | "deleted" }>;
  errors: Array<{ error: string; resolved: boolean }>;
  recentContext: string;
  userPreferences: string[];
  openQuestions: string[];
}

const SECTION_KEYS: ReadonlyArray<keyof CompactionSection> = [
  "activeTasks",
  "decisions",
  "pinnedFacts",
  "filesModified",
  "errors",
  "recentContext",
  "userPreferences",
  "openQuestions",
];

const ARRAY_KEYS = SECTION_KEYS.filter((k) => k !== "recentContext");

/** Create an empty compaction section template. */
export function createEmptyCompaction(): CompactionSection {
  return {
    activeTasks: [],
    decisions: [],
    pinnedFacts: [],
    filesModified: [],
    errors: [],
    recentContext: "",
    userPreferences: [],
    openQuestions: [],
  };
}

/** Parse structured compaction from JSON. Returns null on failure. */
export function parseCompaction(json: string): CompactionSection | null {
  try {
    const parsed: unknown = JSON.parse(json);
    return validateCompaction(parsed).valid ? (parsed as CompactionSection) : null;
  } catch {
    return null;
  }
}

/** Serialize a compaction section to pretty JSON. */
export function serializeCompaction(section: CompactionSection): string {
  return JSON.stringify(section, null, 2);
}

// Deduplicate helper: append items whose key is not already in `existing`.
function unionByKey<T>(existing: T[], incoming: T[], key: (item: T) => string): T[] {
  const seen = new Set(existing.map(key));
  return [...existing, ...incoming.filter((i) => !seen.has(key(i)))];
}

/** Anchored iterative merge: fold update into existing without regenerating. */
export function mergeCompaction(
  existing: CompactionSection,
  update: Partial<CompactionSection>,
): CompactionSection {
  const merged = { ...existing };
  if (update.activeTasks) {
    // Deduplicate by task name; update wins for status changes.
    const taskMap = new Map(existing.activeTasks.map((t) => [t.task, t]));
    for (const t of update.activeTasks) {
      taskMap.set(t.task, t);
    }
    merged.activeTasks = [...taskMap.values()];
  }
  if (update.decisions) {
    merged.decisions = unionByKey(existing.decisions, update.decisions, (d) => d.decision);
  }
  if (update.pinnedFacts) {
    merged.pinnedFacts = unionByKey(existing.pinnedFacts, update.pinnedFacts, (f) => f);
  }
  if (update.filesModified) {
    const fileMap = new Map(existing.filesModified.map((f) => [f.path, f]));
    for (const f of update.filesModified) {
      fileMap.set(f.path, f);
    }
    merged.filesModified = [...fileMap.values()];
  }
  if (update.errors) {
    // Mark old errors resolved when not re-raised, then append new ones.
    const reRaised = new Set(update.errors.map((e) => e.error));
    merged.errors = existing.errors.map((e) =>
      reRaised.has(e.error) ? e : { ...e, resolved: true },
    );
    const known = new Set(existing.errors.map((e) => e.error));
    for (const e of update.errors) {
      if (!known.has(e.error)) {
        merged.errors.push(e);
      }
    }
  }
  if (update.recentContext !== undefined) {
    merged.recentContext = update.recentContext;
  }
  if (update.userPreferences) {
    merged.userPreferences = unionByKey(existing.userPreferences, update.userPreferences, (p) => p);
  }
  if (update.openQuestions) {
    merged.openQuestions = unionByKey(existing.openQuestions, update.openQuestions, (q) => q);
  }
  return merged;
}

/** Build a system prompt instructing the LLM to produce structured JSON output. */
export function buildStructuredCompactionPrompt(pinnedFacts?: string[]): string {
  const schema = JSON.stringify(
    {
      activeTasks: [{ task: "string", status: "in_progress | blocked | done", detail: "string?" }],
      decisions: [{ decision: "string", reason: "string?", timestamp: "number?" }],
      pinnedFacts: ["string"],
      filesModified: [{ path: "string", action: "created | modified | deleted" }],
      errors: [{ error: "string", resolved: "boolean" }],
      recentContext: "string (last 2-3 turns summarized)",
      userPreferences: ["string"],
      openQuestions: ["string"],
    },
    null,
    2,
  );
  const pinned = pinnedFacts?.length
    ? `\n\nAlways include these pinned facts:\n${pinnedFacts.map((f) => `- ${f}`).join("\n")}`
    : "";
  return [
    "Produce a JSON object matching this schema exactly:",
    schema,
    pinned,
    "",
    "Rules:",
    "- Output ONLY valid JSON, no markdown fences.",
    "- recentContext: summarize the last 2-3 conversation turns as prose.",
    "- activeTasks: list every task with its current status.",
    "- errors: include unresolved errors; mark resolved ones as resolved: true.",
  ].join("\n");
}

/** Render a compaction section as human-readable markdown. */
export function formatCompactionSummary(section: CompactionSection): string {
  const lines: string[] = [];
  const push = (heading: string, items: string[]) => {
    if (items.length === 0) {
      return;
    }
    lines.push(`## ${heading}`);
    lines.push(...items);
  };
  push(
    "Active Tasks",
    section.activeTasks.map((t) => `- [${t.status}] ${t.task}${t.detail ? ` — ${t.detail}` : ""}`),
  );
  push(
    "Decisions",
    section.decisions.map((d) => `- ${d.decision}${d.reason ? ` (${d.reason})` : ""}`),
  );
  push(
    "Pinned Facts",
    section.pinnedFacts.map((f) => `- ${f}`),
  );
  push(
    "Files Modified",
    section.filesModified.map((f) => `- ${f.action}: ${f.path}`),
  );
  push(
    "Errors",
    section.errors.map((e) => `- ${e.resolved ? "[resolved]" : "[open]"} ${e.error}`),
  );
  if (section.recentContext) {
    lines.push("## Recent Context");
    lines.push(section.recentContext);
  }
  push(
    "User Preferences",
    section.userPreferences.map((p) => `- ${p}`),
  );
  push(
    "Open Questions",
    section.openQuestions.map((q) => `- ${q}`),
  );
  return lines.join("\n");
}

/** Validate that a value matches the CompactionSection shape. */
export function validateCompaction(section: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (typeof section !== "object" || section === null || Array.isArray(section)) {
    return { valid: false, errors: ["Root must be a non-null object"] };
  }
  const obj = section as Record<string, unknown>;
  for (const key of SECTION_KEYS) {
    if (!(key in obj)) {
      errors.push(`Missing required field: ${key}`);
    }
  }
  if (typeof obj.recentContext !== "undefined" && typeof obj.recentContext !== "string") {
    errors.push("recentContext must be a string");
  }
  for (const arrKey of ARRAY_KEYS) {
    if (arrKey in obj && !Array.isArray(obj[arrKey])) {
      errors.push(`${arrKey} must be an array`);
    }
  }
  return { valid: errors.length === 0, errors };
}

// Lightweight heuristic patterns for extractCompactionInputs.
const FILE_PATH_RE = /(?:^|\s)([\w./-]+\.(?:ts|js|json|md|tsx|jsx|css|html|py|sh))\b/g;
const ERROR_RE = /\b(?:error|Error|ERR|failed|FAIL|exception|Exception|panic)\b/i;
const QUESTION_RE = /\?[\s]*$/m;

/** Extract key information from conversation turns for compaction input. */
export function extractCompactionInputs(
  turns: Array<{ role: "user" | "assistant" | "tool"; content: string; toolName?: string }>,
): Partial<CompactionSection> {
  const files = new Map<string, "created" | "modified" | "deleted">();
  const errorSet = new Set<string>();
  const questions: string[] = [];
  const tasks: CompactionSection["activeTasks"] = [];
  for (const { role, content } of turns) {
    // File paths
    for (const match of content.matchAll(FILE_PATH_RE)) {
      if (!files.has(match[1])) {
        files.set(match[1], "modified");
      }
    }
    // Errors
    if (ERROR_RE.test(content)) {
      const line = content
        .split("\n")
        .find((l) => ERROR_RE.test(l))
        ?.trim();
      if (line && line.length < 300) {
        errorSet.add(line);
      }
    }
    // Questions (user turns only)
    if (role === "user" && QUESTION_RE.test(content)) {
      const qLine = content
        .split("\n")
        .filter((l) => l.trim().endsWith("?"))
        .pop()
        ?.trim();
      if (qLine) {
        questions.push(qLine);
      }
    }
    // Task markers (TODO/TASK lines)
    for (const tl of content.split("\n").filter((l) => /^\s*(?:TODO|TASK)[:\s]/i.test(l))) {
      tasks.push({ task: tl.trim(), status: "in_progress" });
    }
  }
  return {
    filesModified: [...files.entries()].map(([path, action]) => ({ path, action })),
    errors: [...errorSet].map((error) => ({ error, resolved: false })),
    openQuestions: questions,
    activeTasks: tasks,
  };
}
