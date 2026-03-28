import { describe, expect, it } from "vitest";
import {
  ERROR_CATALOG,
  type FriendlyError,
  formatFriendlyError,
  lookupError,
  suggestSimilarErrors,
  wrapError,
} from "./friendly-errors.js";

// ---------------------------------------------------------------------------
// formatFriendlyError
// ---------------------------------------------------------------------------

describe("formatFriendlyError", () => {
  const sampleError: FriendlyError = {
    code: "E099",
    title: "Test error",
    problem: "Something went wrong in the test.",
    hint: "Try fixing the test.",
  };

  it("includes a color-coded header with the error code and title", () => {
    const output = formatFriendlyError(sampleError);
    expect(output).toContain("[E099]");
    expect(output).toContain("Test error");
    expect(output).toContain("\u2717"); // ✗
  });

  it("includes a Problem section", () => {
    const output = formatFriendlyError(sampleError);
    expect(output).toContain("Problem:");
    expect(output).toContain("Something went wrong in the test.");
  });

  it("includes a Hint section", () => {
    const output = formatFriendlyError(sampleError);
    expect(output).toContain("Hint:");
    expect(output).toContain("Try fixing the test.");
  });

  it("renders context key-value pairs when present", () => {
    const err: FriendlyError = {
      ...sampleError,
      context: { port: "8080", host: "localhost" },
    };
    const output = formatFriendlyError(err);
    expect(output).toContain("Context:");
    expect(output).toContain("port:");
    expect(output).toContain("8080");
    expect(output).toContain("host:");
    expect(output).toContain("localhost");
  });

  it("omits the Context section when context is undefined", () => {
    const output = formatFriendlyError(sampleError);
    expect(output).not.toContain("Context:");
  });

  it("omits the Context section when context is an empty object", () => {
    const output = formatFriendlyError({ ...sampleError, context: {} });
    expect(output).not.toContain("Context:");
  });
});

// ---------------------------------------------------------------------------
// ERROR_CATALOG completeness
// ---------------------------------------------------------------------------

describe("ERROR_CATALOG", () => {
  const expectedCodes = [
    "E001",
    "E002",
    "E003",
    "E004",
    "E005",
    "E006",
    "E007",
    "E008",
    "E009",
    "E010",
  ];

  it.each(expectedCodes)("contains entry %s with title, problem, and hint", (code) => {
    const entry = ERROR_CATALOG[code];
    expect(entry).toBeDefined();
    expect(typeof entry.title).toBe("string");
    expect(entry.title.length).toBeGreaterThan(0);
    expect(typeof entry.problem).toBe("string");
    expect(entry.problem.length).toBeGreaterThan(0);
    expect(typeof entry.hint).toBe("string");
    expect(entry.hint.length).toBeGreaterThan(0);
  });

  it("has exactly 10 entries", () => {
    expect(Object.keys(ERROR_CATALOG)).toHaveLength(10);
  });
});

// ---------------------------------------------------------------------------
// wrapError
// ---------------------------------------------------------------------------

describe("wrapError", () => {
  it("categorizes an invalid API key error as E001", () => {
    const err = new Error("The provided api key has invalid format");
    const friendly = wrapError(err);
    expect(friendly.code).toBe("E001");
    expect(friendly.title).toContain("API key");
  });

  it("categorizes a 401 unauthorized error as E002", () => {
    const err = new Error("Request failed with status 401 Unauthorized");
    const friendly = wrapError(err);
    expect(friendly.code).toBe("E002");
  });

  it("categorizes EADDRINUSE as E003", () => {
    const err = new Error("listen EADDRINUSE: address already in use :::18789");
    const friendly = wrapError(err);
    expect(friendly.code).toBe("E003");
  });

  it("categorizes JSON parse errors as E004", () => {
    const err = new Error("Unexpected token in JSON error at position 42");
    const friendly = wrapError(err);
    expect(friendly.code).toBe("E004");
  });

  it("categorizes network errors as E006", () => {
    const err = new Error("getaddrinfo ENOTFOUND api.example.com");
    const friendly = wrapError(err);
    expect(friendly.code).toBe("E006");
  });

  it("categorizes rate limit errors as E007", () => {
    const err = new Error("429 Too Many Requests");
    const friendly = wrapError(err);
    expect(friendly.code).toBe("E007");
  });

  it("falls back to E000 for unrecognized errors", () => {
    const err = new Error("something completely unexpected happened");
    const friendly = wrapError(err);
    expect(friendly.code).toBe("E000");
    expect(friendly.title).toBe("Unexpected error");
  });

  it("preserves the original message in context", () => {
    const err = new Error("boom");
    const friendly = wrapError(err);
    expect(friendly.context?.originalMessage).toBe("boom");
  });

  it("allows callers to override fields", () => {
    const err = new Error("listen EADDRINUSE :::3000");
    const friendly = wrapError(err, {
      title: "Custom title",
      context: { port: "3000" },
    });
    expect(friendly.code).toBe("E003");
    expect(friendly.title).toBe("Custom title");
    expect(friendly.context?.port).toBe("3000");
    expect(friendly.context?.originalMessage).toBe("listen EADDRINUSE :::3000");
  });
});

// ---------------------------------------------------------------------------
// lookupError
// ---------------------------------------------------------------------------

describe("lookupError", () => {
  it("returns the full FriendlyError for a known code", () => {
    const result = lookupError("E003");
    expect(result).toBeDefined();
    expect(result!.code).toBe("E003");
    expect(result!.title).toBe("Gateway port in use");
  });

  it("returns undefined for an unknown code", () => {
    expect(lookupError("E999")).toBeUndefined();
  });

  it("returns undefined for an empty string", () => {
    expect(lookupError("")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// suggestSimilarErrors
// ---------------------------------------------------------------------------

describe("suggestSimilarErrors", () => {
  it("finds errors matching a single keyword", () => {
    const results = suggestSimilarErrors("port");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].code).toBe("E003");
  });

  it("ranks multi-word matches higher", () => {
    const results = suggestSimilarErrors("API key invalid");
    expect(results.length).toBeGreaterThan(0);
    // E001 matches all three words
    expect(results[0].code).toBe("E001");
  });

  it("returns an empty array for a query with no matches", () => {
    expect(suggestSimilarErrors("zzzzxyzzy")).toEqual([]);
  });

  it("returns an empty array for an empty string", () => {
    expect(suggestSimilarErrors("")).toEqual([]);
  });

  it("returns an empty array for whitespace-only input", () => {
    expect(suggestSimilarErrors("   ")).toEqual([]);
  });

  it("matches across title and problem text", () => {
    // "firewall" appears in E006 problem text, not title
    const results = suggestSimilarErrors("firewall");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((e) => e.code === "E006")).toBe(true);
  });

  it("returns results sorted by descending relevance score", () => {
    // "rate limit" should rank E007 highest
    const results = suggestSimilarErrors("rate limit exceeded");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].code).toBe("E007");
  });
});
