import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  validateApiKey,
  validateKeyConnectivity,
  validateKeyFormat,
} from "./api-key-validation.js";

// ---------------------------------------------------------------------------
// Step 1: Format validation
// ---------------------------------------------------------------------------

describe("validateKeyFormat", () => {
  describe("empty / whitespace keys", () => {
    it("rejects an empty string", () => {
      const r = validateKeyFormat("openai", "");
      expect(r.valid).toBe(false);
      expect(r.step).toBe("format");
      expect(r.error).toContain("empty");
    });

    it("rejects a whitespace-only string", () => {
      const r = validateKeyFormat("openai", "   ");
      expect(r.valid).toBe(false);
    });

    it("trims surrounding whitespace before checking", () => {
      // A valid-looking OpenAI key wrapped in spaces should still pass format
      const padded = "  sk-" + "a".repeat(45) + "  ";
      const r = validateKeyFormat("openai", padded);
      expect(r.valid).toBe(true);
    });
  });

  describe("OpenAI", () => {
    it("accepts a valid sk- key", () => {
      const key = "sk-" + "x".repeat(45);
      expect(validateKeyFormat("openai", key).valid).toBe(true);
    });

    it("accepts a long project key", () => {
      const key = "sk-proj-" + "A".repeat(150);
      expect(validateKeyFormat("openai", key).valid).toBe(true);
    });

    it("rejects a key without sk- prefix", () => {
      const r = validateKeyFormat("openai", "pk-" + "x".repeat(45));
      expect(r.valid).toBe(false);
      expect(r.hint).toContain("sk-");
    });

    it("rejects a key that is too short", () => {
      const r = validateKeyFormat("openai", "sk-abc");
      expect(r.valid).toBe(false);
    });
  });

  describe("Anthropic", () => {
    it("accepts a valid sk-ant- key", () => {
      const key = "sk-ant-" + "y".repeat(40);
      expect(validateKeyFormat("anthropic", key).valid).toBe(true);
    });

    it("rejects a key with only sk- prefix (no ant)", () => {
      const r = validateKeyFormat("anthropic", "sk-" + "y".repeat(40));
      expect(r.valid).toBe(false);
      expect(r.hint).toContain("sk-ant-");
    });

    it("rejects a key that is too short", () => {
      expect(validateKeyFormat("anthropic", "sk-ant-abc").valid).toBe(false);
    });
  });

  describe("Google / Gemini", () => {
    it("accepts a valid AI-prefixed key (google)", () => {
      const key = "AI" + "z".repeat(35);
      expect(validateKeyFormat("google", key).valid).toBe(true);
    });

    it("accepts via gemini alias", () => {
      const key = "AI" + "z".repeat(35);
      expect(validateKeyFormat("gemini", key).valid).toBe(true);
    });

    it("rejects a key without AI prefix", () => {
      expect(validateKeyFormat("google", "XX" + "z".repeat(35)).valid).toBe(false);
    });

    it("rejects a key that is too long", () => {
      const key = "AI" + "z".repeat(60);
      expect(validateKeyFormat("google", key).valid).toBe(false);
    });
  });

  describe("fal.ai", () => {
    it("accepts a key with colon separator", () => {
      expect(validateKeyFormat("fal.ai", "abc:def123").valid).toBe(true);
    });

    it("accepts via fal alias", () => {
      expect(validateKeyFormat("fal", "abc:def123").valid).toBe(true);
    });

    it("rejects a key without colon", () => {
      const r = validateKeyFormat("fal.ai", "abcdef123");
      expect(r.valid).toBe(false);
      expect(r.hint).toContain(":");
    });
  });

  describe("unknown provider (generic fallback)", () => {
    it("accepts a reasonable key", () => {
      expect(validateKeyFormat("some-provider", "mykey123").valid).toBe(true);
    });

    it("rejects a key with leading whitespace (after trim it may be fine)", () => {
      // After trimming, "  key" becomes "key", which passes generic check.
      expect(validateKeyFormat("some-provider", "  key  ").valid).toBe(true);
    });

    it("rejects a key containing newlines after trim", () => {
      // "\nkey\n" trims to "key" which is valid. But "ke\ny" stays "ke\ny" which fails.
      expect(validateKeyFormat("some-provider", "ke\ny").valid).toBe(false);
    });
  });

  describe("provider normalization", () => {
    it("is case-insensitive", () => {
      const key = "sk-" + "x".repeat(45);
      expect(validateKeyFormat("OpenAI", key).valid).toBe(true);
      expect(validateKeyFormat("OPENAI", key).valid).toBe(true);
    });

    it("trims provider name", () => {
      const key = "sk-" + "x".repeat(45);
      expect(validateKeyFormat("  openai  ", key).valid).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Step 2: Connectivity validation (mocked fetch)
// ---------------------------------------------------------------------------

describe("validateKeyConnectivity", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns models for a successful OpenAI call", async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ id: "gpt-5.4" }, { id: "gpt-5-mini" }] }),
    });

    const r = await validateKeyConnectivity("openai", "sk-test123");
    expect(r.valid).toBe(true);
    expect(r.step).toBe("connectivity");
    expect(r.models).toEqual(["gpt-5.4", "gpt-5-mini"]);
  });

  it("reports failure for OpenAI 401", async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    });

    const r = await validateKeyConnectivity("openai", "sk-bad");
    expect(r.valid).toBe(false);
    expect(r.error).toContain("401");
  });

  it("validates Anthropic key (non-401/403 = success)", async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
    // 200 means key works
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const r = await validateKeyConnectivity("anthropic", "sk-ant-test");
    expect(r.valid).toBe(true);
  });

  it("reports failure for Anthropic 401", async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, statusText: "Unauthorized" });

    const r = await validateKeyConnectivity("anthropic", "sk-ant-bad");
    expect(r.valid).toBe(false);
    expect(r.error).toContain("authentication failed");
  });

  it("returns models for Gemini", async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ models: [{ name: "models/gemini-3.1-pro" }] }),
    });

    const r = await validateKeyConnectivity("gemini", "AItest");
    expect(r.valid).toBe(true);
    expect(r.models).toEqual(["models/gemini-3.1-pro"]);
  });

  it("validates fal.ai key", async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const r = await validateKeyConnectivity("fal.ai", "id:secret");
    expect(r.valid).toBe(true);
  });

  it("returns error for unknown provider", async () => {
    const r = await validateKeyConnectivity("unknown-provider", "somekey");
    expect(r.valid).toBe(false);
    expect(r.error).toContain("No connectivity check");
  });

  it("handles network errors gracefully", async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockRejectedValueOnce(new Error("fetch failed"));

    const r = await validateKeyConnectivity("openai", "sk-test");
    expect(r.valid).toBe(false);
    expect(r.error).toContain("Network error");
    expect(r.error).toContain("fetch failed");
  });
});

// ---------------------------------------------------------------------------
// Step 3: Full pipeline (validateApiKey)
// ---------------------------------------------------------------------------

describe("validateApiKey", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("short-circuits on format failure without making a network call", async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;

    const r = await validateApiKey("openai", "bad-key");
    expect(r.valid).toBe(false);
    expect(r.step).toBe("format");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("proceeds to connectivity when format passes", async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ id: "gpt-5.4" }] }),
    });

    const key = "sk-" + "a".repeat(45);
    const r = await validateApiKey("openai", key);
    expect(r.valid).toBe(true);
    expect(r.step).toBe("connectivity");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
