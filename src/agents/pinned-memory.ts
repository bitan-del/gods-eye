import { randomUUID } from "node:crypto";

export interface PinnedFact {
  id: string;
  content: string;
  category: "decision" | "preference" | "context" | "instruction" | "custom";
  createdAt: number;
  source: "user" | "agent" | "system";
  priority: number; // 1-10, higher = more important
  tags?: string[];
}

export interface PinnedMemoryStore {
  /** Pin a new fact */
  pin(
    content: string,
    opts?: Partial<Omit<PinnedFact, "id" | "content" | "createdAt">>,
  ): PinnedFact;

  /** Remove a pinned fact by ID or content substring */
  unpin(idOrSubstring: string): boolean;

  /** Get all pinned facts, sorted by priority (highest first) */
  getAll(): PinnedFact[];

  /** Get pinned facts by category */
  getByCategory(category: PinnedFact["category"]): PinnedFact[];

  /** Search pinned facts by keyword */
  search(query: string): PinnedFact[];

  /** Format all pinned facts as a compaction-safe block */
  formatForCompaction(): string;

  /** Format as a prompt injection section */
  formatForPrompt(): string;

  /** Get count */
  count(): number;

  /** Clear all */
  clear(): void;

  /** Export as JSON (for persistence) */
  export(): PinnedFact[];

  /** Import from JSON (for restore) */
  import(facts: PinnedFact[]): void;
}

export interface PinnedMemoryConfig {
  maxPins: number; // max pinned facts (default 50)
  maxContentLength: number; // max chars per fact (default 500)
}

const DEFAULT_CONFIG: PinnedMemoryConfig = {
  maxPins: 50,
  maxContentLength: 500,
};

/** Sort facts by priority descending, then by creation time descending. */
function sortByPriority(facts: PinnedFact[]): PinnedFact[] {
  return [...facts].toSorted((a, b) => b.priority - a.priority || b.createdAt - a.createdAt);
}

function matchesCI(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase());
}

/** Create a pinned memory store */
export function createPinnedMemory(config?: Partial<PinnedMemoryConfig>): PinnedMemoryStore {
  const cfg: PinnedMemoryConfig = { ...DEFAULT_CONFIG, ...config };
  const facts = new Map<string, PinnedFact>();

  function truncate(text: string): string {
    return text.length > cfg.maxContentLength ? text.slice(0, cfg.maxContentLength) : text;
  }

  /** Evict lowest-priority facts when over capacity. */
  function evictIfNeeded(): void {
    if (facts.size <= cfg.maxPins) {
      return;
    }
    for (const f of sortByPriority([...facts.values()]).slice(cfg.maxPins)) {
      facts.delete(f.id);
    }
  }

  return {
    pin(content, opts) {
      const fact: PinnedFact = {
        id: randomUUID(),
        content: truncate(content),
        category: opts?.category ?? "custom",
        createdAt: Date.now(),
        source: opts?.source ?? "user",
        priority: opts?.priority ?? 5,
        ...(opts?.tags ? { tags: opts.tags } : {}),
      };
      facts.set(fact.id, fact);
      evictIfNeeded();
      return fact;
    },

    unpin(idOrSubstring) {
      // Try exact ID match first
      if (facts.has(idOrSubstring)) {
        facts.delete(idOrSubstring);
        return true;
      }
      // Fall back to content substring match (remove first match)
      for (const [id, fact] of facts) {
        if (matchesCI(fact.content, idOrSubstring)) {
          facts.delete(id);
          return true;
        }
      }
      return false;
    },

    getAll() {
      return sortByPriority([...facts.values()]);
    },

    getByCategory(category) {
      return sortByPriority([...facts.values()].filter((f) => f.category === category));
    },

    search(query) {
      const q = query.toLowerCase();
      return sortByPriority(
        [...facts.values()].filter(
          (f) => matchesCI(f.content, q) || (f.tags?.some((t) => matchesCI(t, q)) ?? false),
        ),
      );
    },

    formatForCompaction() {
      const sorted = sortByPriority([...facts.values()]);
      if (sorted.length === 0) {
        return "";
      }
      const lines = sorted.map((f) => `- [${f.category}] ${f.content}`);
      return `## Pinned Facts (DO NOT REMOVE)\n${lines.join("\n")}`;
    },

    formatForPrompt() {
      const sorted = sortByPriority([...facts.values()]);
      if (sorted.length === 0) {
        return "";
      }
      return `<pinned-facts>\n${sorted.map((f) => `- ${f.content}`).join("\n")}\n</pinned-facts>`;
    },

    count() {
      return facts.size;
    },

    clear() {
      facts.clear();
    },

    export() {
      return sortByPriority([...facts.values()]);
    },

    import(incoming) {
      for (const fact of incoming) {
        facts.set(fact.id, { ...fact, content: truncate(fact.content) });
      }
      evictIfNeeded();
    },
  };
}
