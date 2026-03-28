import { describe, expect, it, vi, beforeEach } from "vitest";
import { createCache, DEFAULT_CACHE_CONFIG } from "./semantic-cache.js";
import type { SemanticCache } from "./semantic-cache.js";

describe("semantic-cache", () => {
  let cache: SemanticCache;

  beforeEach(() => {
    cache = createCache();
  });

  // -- exact match --
  it("returns cached response for exact same prompt", () => {
    cache.set("Hello world", "response-1", "sonnet-4.6", 100);
    const hit = cache.get("Hello world", "sonnet-4.6");
    expect(hit).not.toBeNull();
    expect(hit!.response).toBe("response-1");
  });

  // -- cache miss for different prompt --
  it("returns null for a completely different prompt", () => {
    cache.set("Hello world", "response-1", "sonnet-4.6", 100);
    const miss = cache.get("Explain quantum physics in detail", "sonnet-4.6");
    expect(miss).toBeNull();
  });

  // -- near-identical prompts (whitespace/punctuation) --
  it("matches prompts that differ only by whitespace and punctuation", () => {
    cache.set("Hello, world!", "response-1", "sonnet-4.6", 100);
    const hit = cache.get("hello   world", "sonnet-4.6");
    expect(hit).not.toBeNull();
    expect(hit!.response).toBe("response-1");
  });

  // -- TTL expiry --
  it("evicts entries after TTL expires", () => {
    vi.useFakeTimers();
    try {
      const short = createCache({ ttlMs: 500 });
      short.set("prompt", "resp", "sonnet-4.6", 50);
      expect(short.get("prompt", "sonnet-4.6")).not.toBeNull();

      vi.advanceTimersByTime(600);
      expect(short.get("prompt", "sonnet-4.6")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  // -- LRU eviction when full --
  it("evicts least-recently-used entry when maxEntries exceeded", () => {
    const tiny = createCache({ maxEntries: 2 });
    tiny.set("first prompt", "r1", "sonnet-4.6", 10);
    tiny.set("second prompt", "r2", "sonnet-4.6", 20);
    // Access first to make it recently used.
    tiny.get("first prompt", "sonnet-4.6");
    // Adding a third should evict 'second prompt' (LRU).
    tiny.set("third prompt", "r3", "sonnet-4.6", 30);

    expect(tiny.get("second prompt", "sonnet-4.6")).toBeNull();
    expect(tiny.get("first prompt", "sonnet-4.6")).not.toBeNull();
    expect(tiny.get("third prompt", "sonnet-4.6")).not.toBeNull();
  });

  // -- stats tracking --
  it("tracks hits, misses, and hit rate correctly", () => {
    cache.set("a", "r", "sonnet-4.6", 50);
    cache.get("a", "sonnet-4.6"); // hit
    cache.get("a", "sonnet-4.6"); // hit
    cache.get("zzz completely different", "sonnet-4.6"); // miss

    const s = cache.stats();
    expect(s.totalHits).toBe(2);
    expect(s.totalMisses).toBe(1);
    expect(s.hitRate).toBeCloseTo(2 / 3, 5);
    expect(s.totalEntries).toBe(1);
  });

  // -- token savings calculation --
  it("calculates cumulative token savings from hit counts", () => {
    cache.set("prompt", "resp", "sonnet-4.6", 200);
    cache.get("prompt", "sonnet-4.6"); // hit 1
    cache.get("prompt", "sonnet-4.6"); // hit 2

    const s = cache.stats();
    // 200 tokens * 2 hits = 400 total saved
    expect(s.totalTokensSaved).toBe(400);
    expect(s.estimatedCostSaved).toBeGreaterThan(0);
  });

  // -- model-scoped caching --
  it("treats same prompt with different model as a miss", () => {
    cache.set("Hello world", "response-sonnet", "sonnet-4.6", 100);
    const miss = cache.get("Hello world", "gpt-5.4");
    expect(miss).toBeNull();
  });

  // -- clear cache --
  it("clears all entries and resets stats", () => {
    cache.set("a", "r", "sonnet-4.6", 50);
    cache.get("a", "sonnet-4.6");
    cache.clear();

    expect(cache.get("a", "sonnet-4.6")).toBeNull();
    const s = cache.stats();
    expect(s.totalEntries).toBe(0);
    expect(s.totalHits).toBe(0);
    // The get() above after clear counts as a miss.
    expect(s.totalMisses).toBe(1);
  });

  // -- disabled cache --
  it("returns null when cache is disabled", () => {
    const disabled = createCache({ enabled: false });
    disabled.set("prompt", "resp", "sonnet-4.6", 100);
    expect(disabled.get("prompt", "sonnet-4.6")).toBeNull();
    expect(disabled.stats().totalEntries).toBe(0);
  });

  // -- empty/whitespace prompt --
  it("returns null for empty or whitespace-only prompts", () => {
    cache.set("real prompt", "resp", "sonnet-4.6", 50);
    expect(cache.get("", "sonnet-4.6")).toBeNull();
    expect(cache.get("   ", "sonnet-4.6")).toBeNull();
  });

  it("does not store empty or whitespace-only prompts", () => {
    cache.set("", "resp", "sonnet-4.6", 50);
    cache.set("   ", "resp", "sonnet-4.6", 50);
    expect(cache.stats().totalEntries).toBe(0);
  });

  // -- manual evict() returns count --
  it("evict() returns the number of expired entries removed", () => {
    vi.useFakeTimers();
    try {
      const short = createCache({ ttlMs: 100 });
      short.set("a", "r1", "sonnet-4.6", 10);
      short.set("b", "r2", "sonnet-4.6", 10);
      vi.advanceTimersByTime(200);
      expect(short.evict()).toBe(2);
      expect(short.stats().totalEntries).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  // -- default config --
  it("exports sensible default config values", () => {
    expect(DEFAULT_CACHE_CONFIG.enabled).toBe(true);
    expect(DEFAULT_CACHE_CONFIG.maxEntries).toBe(1000);
    expect(DEFAULT_CACHE_CONFIG.ttlMs).toBe(3_600_000);
    expect(DEFAULT_CACHE_CONFIG.similarityThreshold).toBe(0.95);
  });

  // -- hit increments hitCount --
  it("increments hitCount on the entry for each cache hit", () => {
    cache.set("prompt", "resp", "sonnet-4.6", 100);
    cache.get("prompt", "sonnet-4.6");
    cache.get("prompt", "sonnet-4.6");
    const entry = cache.get("prompt", "sonnet-4.6");
    expect(entry!.hitCount).toBe(3);
  });
});
