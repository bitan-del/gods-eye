// Recall — semantic search across all creative memory.
// "Remember when..." retrieval for brands, generations, characters, calendar.

import type { BrainMemory, GenerationRecord } from "./memory.js";

export interface RecallResult {
  type: "generation" | "brand" | "character" | "calendar";
  id: string;
  label: string;
  snippet: string;
  score: number;
}

/**
 * Simple keyword-based recall across all creative memory.
 * Future: replace with vector embeddings for semantic search.
 */
export function recallFromMemory(brain: BrainMemory, query: string): RecallResult[] {
  const results: RecallResult[] = [];
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter(Boolean);

  // Score based on how many query terms appear in the text
  function score(text: string): number {
    const textLower = text.toLowerCase();
    let matched = 0;
    for (const term of queryTerms) {
      if (textLower.includes(term)) matched++;
    }
    return queryTerms.length > 0 ? matched / queryTerms.length : 0;
  }

  // Search generations
  for (const gen of brain.recentGenerations(50)) {
    const text = `${gen.prompt} ${gen.tags.join(" ")} ${gen.model} ${gen.type}`;
    const s = score(text);
    if (s > 0) {
      results.push({
        type: "generation",
        id: gen.id,
        label: `${gen.type} generation (${gen.model})`,
        snippet: gen.prompt.slice(0, 120),
        score: s,
      });
    }
  }

  // Search brands
  for (const brand of brain.listBrands()) {
    const text = `${brand.name} ${brand.tone ?? ""} ${brand.visualStyle ?? ""}`;
    const s = score(text);
    if (s > 0) {
      results.push({
        type: "brand",
        id: brand.id,
        label: `Brand: ${brand.name}`,
        snippet: `${brand.colors.primary} / ${brand.colors.secondary}${brand.tone ? ` — ${brand.tone}` : ""}`,
        score: s,
      });
    }
  }

  // Search characters
  for (const char of brain.listCharacters()) {
    const text = `${char.name} ${char.description ?? ""} ${char.style ?? ""}`;
    const s = score(text);
    if (s > 0) {
      results.push({
        type: "character",
        id: char.id,
        label: `Character: ${char.name}`,
        snippet: char.description?.slice(0, 120) ?? char.name,
        score: s,
      });
    }
  }

  // Sort by score descending
  return results.sort((a, b) => b.score - a.score).slice(0, 20);
}

/**
 * Find generations similar to a given one (by overlapping tags and prompt terms).
 */
export function findSimilarGenerations(
  brain: BrainMemory,
  referenceGen: GenerationRecord,
  limit = 5,
): GenerationRecord[] {
  const refTerms = new Set(
    [
      ...referenceGen.prompt.toLowerCase().split(/\s+/),
      ...referenceGen.tags.map((t) => t.toLowerCase()),
    ].filter(Boolean),
  );

  return brain
    .recentGenerations(50, referenceGen.type)
    .filter((g) => g.id !== referenceGen.id)
    .map((g) => {
      const gTerms = [
        ...g.prompt.toLowerCase().split(/\s+/),
        ...g.tags.map((t) => t.toLowerCase()),
      ];
      const overlap = gTerms.filter((t) => refTerms.has(t)).length;
      return { gen: g, overlap };
    })
    .filter(({ overlap }) => overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, limit)
    .map(({ gen }) => gen);
}
