// Studio Recall tool — search creative memory from the agent.
// "Remember when we made that red hero banner?" — this tool finds it.

import type { BrainMemory } from "../brain/memory.js";
import { recallFromMemory } from "../brain/recall.js";

export function buildRecallToolDef() {
  return {
    name: "studio_recall",
    description: [
      "Search creative memory for past generations, brands, characters, and calendar slots.",
      'Handles queries like "find the campaign with red backgrounds" or',
      '"what style did we use last Tuesday".',
      "Returns ranked results from the brain.",
    ].join(" "),
    parameters: {
      type: "object" as const,
      properties: {
        query: {
          type: "string" as const,
          description: "Natural language search query across creative memory.",
        },
        type: {
          type: "string" as const,
          description:
            'Filter by type: "generation", "brand", "character", "calendar", or omit for all.',
        },
        limit: {
          type: "number" as const,
          description: "Maximum results to return (default 10).",
        },
      },
      required: ["query"] as const,
    },
  };
}

export function executeRecall(
  brain: BrainMemory,
  params: { query: string; type?: string; limit?: number },
) {
  let results = recallFromMemory(brain, params.query);
  if (params.type) {
    results = results.filter((r) => r.type === params.type);
  }
  return results.slice(0, params.limit ?? 10);
}
