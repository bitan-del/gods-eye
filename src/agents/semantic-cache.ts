import { createHash } from "node:crypto";

export interface CacheEntry {
  key: string;
  prompt: string;
  response: string;
  model: string;
  tokensSaved: number;
  createdAt: number;
  hitCount: number;
  ttl: number;
}

export interface CacheStats {
  totalEntries: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  totalTokensSaved: number;
  estimatedCostSaved: number;
}

export interface SemanticCacheConfig {
  enabled: boolean;
  maxEntries: number;
  ttlMs: number;
  similarityThreshold: number;
}

export const DEFAULT_CACHE_CONFIG: SemanticCacheConfig = {
  enabled: true,
  maxEntries: 1000,
  ttlMs: 60 * 60 * 1000,
  similarityThreshold: 0.95,
};

const COST_PER_TOKEN = 0.000003; // rough blended USD per token

export interface SemanticCache {
  get(prompt: string, model: string): CacheEntry | null;
  set(prompt: string, response: string, model: string, tokens: number): void;
  stats(): CacheStats;
  clear(): void;
  evict(): number;
}

/** Lowercase, strip punctuation, collapse whitespace, sort words. */
function normalize(p: string): string {
  return p
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .toSorted()
    .join(" ");
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Character trigram set for Jaccard similarity. */
function trigrams(s: string): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i <= s.length - 3; i++) {
    out.add(s.slice(i, i + 3));
  }
  return out;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) {
    return 1;
  }
  let inter = 0;
  for (const t of a) {
    if (b.has(t)) {
      inter++;
    }
  }
  const union = a.size + b.size - inter;
  if (union === 0) {
    return 1;
  }
  return inter / union;
}

function compositeKey(norm: string, model: string): string {
  return sha256(`${model}::${norm}`);
}

export function createCache(config?: Partial<SemanticCacheConfig>): SemanticCache {
  const cfg: SemanticCacheConfig = { ...DEFAULT_CACHE_CONFIG, ...config };
  const entries = new Map<string, CacheEntry>();
  const triIdx = new Map<string, { norm: string; tri: Set<string> }>();
  const lru: string[] = []; // most-recently-used at end
  let totalHits = 0;
  let totalMisses = 0;

  function touchLru(key: string): void {
    const i = lru.indexOf(key);
    if (i !== -1) {
      lru.splice(i, 1);
    }
    lru.push(key);
  }

  function evictLru(): void {
    while (entries.size > cfg.maxEntries && lru.length > 0) {
      const old = lru.shift()!;
      entries.delete(old);
      triIdx.delete(old);
    }
  }

  function evictExpired(): number {
    const now = Date.now();
    let n = 0;
    for (const [k, e] of entries) {
      if (now - e.createdAt > e.ttl) {
        entries.delete(k);
        triIdx.delete(k);
        const i = lru.indexOf(k);
        if (i !== -1) {
          lru.splice(i, 1);
        }
        n++;
      }
    }
    return n;
  }

  function fuzzyLookup(norm: string, model: string): CacheEntry | null {
    const qTri = trigrams(norm);
    let best: CacheEntry | null = null;
    let bestSim = 0;
    for (const [k, info] of triIdx) {
      const e = entries.get(k);
      if (!e || e.model !== model) {
        continue;
      }
      const sim = jaccardSimilarity(qTri, info.tri);
      if (sim >= cfg.similarityThreshold && sim > bestSim) {
        bestSim = sim;
        best = e;
      }
    }
    return best;
  }

  return {
    get(prompt: string, model: string): CacheEntry | null {
      if (!cfg.enabled) {
        return null;
      }
      const trimmed = prompt.trim();
      if (!trimmed) {
        return null;
      }
      evictExpired(); // lazy TTL cleanup
      const norm = normalize(trimmed);
      const key = compositeKey(norm, model);
      // Fast path: exact hash match.
      const exact = entries.get(key);
      if (exact) {
        exact.hitCount++;
        totalHits++;
        touchLru(key);
        return exact;
      }
      // Slow path: trigram fuzzy match.
      const fuzzy = fuzzyLookup(norm, model);
      if (fuzzy) {
        fuzzy.hitCount++;
        totalHits++;
        touchLru(fuzzy.key);
        return fuzzy;
      }
      totalMisses++;
      return null;
    },

    set(prompt: string, response: string, model: string, tokens: number): void {
      if (!cfg.enabled) {
        return;
      }
      const trimmed = prompt.trim();
      if (!trimmed) {
        return;
      }
      const norm = normalize(trimmed);
      const key = compositeKey(norm, model);
      entries.set(key, {
        key,
        prompt: trimmed,
        response,
        model,
        tokensSaved: tokens,
        createdAt: Date.now(),
        hitCount: 0,
        ttl: cfg.ttlMs,
      });
      triIdx.set(key, { norm, tri: trigrams(norm) });
      touchLru(key);
      evictLru();
    },

    stats(): CacheStats {
      const saved = [...entries.values()].reduce((s, e) => s + e.tokensSaved * e.hitCount, 0);
      const total = totalHits + totalMisses;
      return {
        totalEntries: entries.size,
        totalHits,
        totalMisses,
        hitRate: total === 0 ? 0 : totalHits / total,
        totalTokensSaved: saved,
        estimatedCostSaved: saved * COST_PER_TOKEN,
      };
    },

    clear(): void {
      entries.clear();
      triIdx.clear();
      lru.length = 0;
      totalHits = 0;
      totalMisses = 0;
    },

    evict(): number {
      return evictExpired();
    },
  };
}
