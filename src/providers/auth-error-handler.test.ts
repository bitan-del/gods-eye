import { describe, expect, it } from "vitest";
import {
  type AuthError,
  classifyAuthError,
  createAuthErrorFromException,
  formatAuthError,
  getProviderHint,
  getRetryDelay,
  isRetryable,
} from "./auth-error-handler.ts";

describe("classifyAuthError", () => {
  it("classifies 401 as invalid_key", () => {
    const err = classifyAuthError("openai", 401);
    expect(err.type).toBe("invalid_key");
    expect(err.retryable).toBe(false);
    expect(err.provider).toBe("openai");
    expect(err.httpStatus).toBe(401);
  });

  it("classifies 403 as insufficient_permissions", () => {
    const err = classifyAuthError("anthropic", 403);
    expect(err.type).toBe("insufficient_permissions");
    expect(err.retryable).toBe(false);
  });

  it("classifies 429 as rate_limited and marks retryable", () => {
    const err = classifyAuthError("google", 429);
    expect(err.type).toBe("rate_limited");
    expect(err.retryable).toBe(true);
  });

  it("classifies 402 as quota_exceeded", () => {
    const err = classifyAuthError("openai", 402);
    expect(err.type).toBe("quota_exceeded");
    expect(err.retryable).toBe(false);
  });

  it("classifies 500 as provider_down and marks retryable", () => {
    const err = classifyAuthError("fal", 500);
    expect(err.type).toBe("provider_down");
    expect(err.retryable).toBe(true);
  });

  it("classifies 503 as provider_down", () => {
    const err = classifyAuthError("anthropic", 503);
    expect(err.type).toBe("provider_down");
    expect(err.retryable).toBe(true);
  });

  it("classifies 502 as provider_down", () => {
    const err = classifyAuthError("openai", 502);
    expect(err.type).toBe("provider_down");
    expect(err.retryable).toBe(true);
  });

  it("classifies unknown status codes as unknown", () => {
    const err = classifyAuthError("openai", 418);
    expect(err.type).toBe("unknown");
    expect(err.retryable).toBe(false);
  });

  it("parses retry-after from JSON response body on 429", () => {
    const body = JSON.stringify({ retry_after: 30 });
    const err = classifyAuthError("anthropic", 429, body);
    expect(err.type).toBe("rate_limited");
    expect(err.retryAfterMs).toBe(30_000);
  });

  it("parses Retry-After header format from response body", () => {
    const body = "Retry-After: 10";
    const err = classifyAuthError("openai", 429, body);
    expect(err.retryAfterMs).toBe(10_000);
  });

  it("extracts error message from JSON response body", () => {
    const body = JSON.stringify({
      error: { message: "Invalid API key provided" },
    });
    const err = classifyAuthError("openai", 401, body);
    expect(err.message).toContain("Invalid API key provided");
  });

  it("handles non-JSON response body gracefully", () => {
    const err = classifyAuthError("openai", 401, "not json");
    expect(err.type).toBe("invalid_key");
    expect(err.message).toContain("[openai]");
  });
});

describe("getProviderHint", () => {
  it("returns openai-specific hint for invalid_key", () => {
    const hint = getProviderHint("openai", "invalid_key");
    expect(hint).toContain("platform.openai.com/api-keys");
  });

  it("returns anthropic-specific hint for invalid_key", () => {
    const hint = getProviderHint("anthropic", "invalid_key");
    expect(hint).toContain("console.anthropic.com/settings/keys");
  });

  it("returns google-specific hint for invalid_key", () => {
    const hint = getProviderHint("google", "invalid_key");
    expect(hint).toContain("aistudio.google.com/apikey");
  });

  it("returns gemini-specific hint for invalid_key", () => {
    const hint = getProviderHint("gemini", "invalid_key");
    expect(hint).toContain("aistudio.google.com/apikey");
  });

  it("returns fal-specific hint for invalid_key", () => {
    const hint = getProviderHint("fal", "invalid_key");
    expect(hint).toContain("fal.ai/dashboard/keys");
  });

  it("returns default hint for unknown provider", () => {
    const hint = getProviderHint("unknown-provider", "invalid_key");
    expect(hint).toContain("Verify your API key");
  });

  it("is case-insensitive for provider names", () => {
    const hint = getProviderHint("OpenAI", "invalid_key");
    expect(hint).toContain("platform.openai.com/api-keys");
  });
});

describe("isRetryable", () => {
  it("returns true for rate_limited errors", () => {
    const err = classifyAuthError("openai", 429);
    expect(isRetryable(err)).toBe(true);
  });

  it("returns true for provider_down errors", () => {
    const err = classifyAuthError("openai", 500);
    expect(isRetryable(err)).toBe(true);
  });

  it("returns false for invalid_key errors", () => {
    const err = classifyAuthError("openai", 401);
    expect(isRetryable(err)).toBe(false);
  });

  it("returns false for quota_exceeded errors", () => {
    const err = classifyAuthError("openai", 402);
    expect(isRetryable(err)).toBe(false);
  });

  it("returns true for network_error type", () => {
    const err = createAuthErrorFromException("openai", new Error("ECONNREFUSED"));
    expect(isRetryable(err)).toBe(true);
  });
});

describe("getRetryDelay", () => {
  it("returns exponentially increasing delays", () => {
    const err = classifyAuthError("openai", 429);
    const delay0 = getRetryDelay(err, 0);
    const delay1 = getRetryDelay(err, 1);
    const delay2 = getRetryDelay(err, 2);

    // Base delay is 1000ms * 2^attempt + jitter(0-1000)
    // attempt 0: 1000-2000, attempt 1: 2000-3000, attempt 2: 4000-5000
    expect(delay0).toBeGreaterThanOrEqual(1000);
    expect(delay0).toBeLessThanOrEqual(2000);
    expect(delay1).toBeGreaterThanOrEqual(2000);
    expect(delay1).toBeLessThanOrEqual(3000);
    expect(delay2).toBeGreaterThanOrEqual(4000);
    expect(delay2).toBeLessThanOrEqual(5000);
  });

  it("caps delay at 60 seconds", () => {
    const err = classifyAuthError("openai", 500);
    const delay = getRetryDelay(err, 20);
    expect(delay).toBeLessThanOrEqual(60_000);
  });

  it("respects retryAfterMs when it exceeds calculated delay", () => {
    const err: AuthError = {
      type: "rate_limited",
      provider: "openai",
      httpStatus: 429,
      message: "rate limited",
      retryable: true,
      retryAfterMs: 30_000,
      hint: "wait",
    };
    const delay = getRetryDelay(err, 0);
    // retryAfterMs (30s) exceeds the exponential delay (~1-2s), so 30s is used
    expect(delay).toBe(30_000);
  });
});

describe("formatAuthError", () => {
  it("includes all relevant fields in output", () => {
    const err = classifyAuthError("openai", 401);
    const formatted = formatAuthError(err);

    expect(formatted).toContain("Provider: openai");
    expect(formatted).toContain("HTTP Status: 401");
    expect(formatted).toContain("Type: invalid_key");
    expect(formatted).toContain("Retryable: no");
    expect(formatted).toContain("Hint:");
  });

  it("includes retry-after when present", () => {
    const body = JSON.stringify({ retry_after: 15 });
    const err = classifyAuthError("anthropic", 429, body);
    const formatted = formatAuthError(err);

    expect(formatted).toContain("Retryable: yes");
    expect(formatted).toContain("Retry after: 15s");
  });

  it("omits HTTP Status line when httpStatus is undefined", () => {
    const err = createAuthErrorFromException("openai", new Error("ECONNREFUSED"));
    const formatted = formatAuthError(err);
    expect(formatted).not.toContain("HTTP Status:");
  });
});

describe("createAuthErrorFromException", () => {
  it("classifies ECONNREFUSED as network_error", () => {
    const err = createAuthErrorFromException(
      "openai",
      new Error("connect ECONNREFUSED 127.0.0.1:443"),
    );
    expect(err.type).toBe("network_error");
    expect(err.retryable).toBe(true);
  });

  it("classifies ETIMEDOUT as network_error", () => {
    const err = createAuthErrorFromException("anthropic", new Error("connect ETIMEDOUT"));
    expect(err.type).toBe("network_error");
    expect(err.retryable).toBe(true);
  });

  it("classifies fetch failed as network_error", () => {
    const err = createAuthErrorFromException("google", new Error("fetch failed"));
    expect(err.type).toBe("network_error");
    expect(err.retryable).toBe(true);
  });

  it("classifies ENOTFOUND as network_error", () => {
    const err = createAuthErrorFromException("fal", new Error("getaddrinfo ENOTFOUND api.fal.ai"));
    expect(err.type).toBe("network_error");
  });

  it("classifies unrecognized errors as unknown", () => {
    const err = createAuthErrorFromException(
      "openai",
      new Error("something completely unexpected"),
    );
    expect(err.type).toBe("unknown");
    expect(err.retryable).toBe(false);
  });

  it("preserves the original error message", () => {
    const err = createAuthErrorFromException("openai", new Error("custom error detail"));
    expect(err.message).toContain("custom error detail");
  });
});
