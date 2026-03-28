/**
 * Three-step API key validation for AI provider keys.
 *
 * Step 1 (format):       Instant offline regex check.
 * Step 2 (connectivity): Lightweight API call proving auth works.
 * Step 3 (validateApiKey): Full pipeline (format then connectivity).
 */

export interface KeyValidationResult {
  valid: boolean;
  step: "format" | "connectivity" | "capability";
  provider: string;
  error?: string;
  hint?: string;
  /** Available models when connectivity check passes (provider-dependent). */
  models?: string[];
}

// ---------------------------------------------------------------------------
// Format rules per provider
// ---------------------------------------------------------------------------

type FormatRule = {
  test: (key: string) => boolean;
  hint: string;
};

const FORMAT_RULES: Record<string, FormatRule> = {
  openai: {
    test: (k) => /^sk-.{38,198}$/.test(k),
    hint: 'OpenAI keys start with "sk-" and are 40-200 characters long.',
  },
  anthropic: {
    test: (k) => /^sk-ant-.{34,194}$/.test(k),
    hint: 'Anthropic keys start with "sk-ant-" and are 40-200 characters long.',
  },
  google: {
    test: (k) => /^AI.{28,48}$/.test(k),
    hint: 'Google/Gemini keys start with "AI" and are 30-50 characters long.',
  },
  gemini: {
    test: (k) => /^AI.{28,48}$/.test(k),
    hint: 'Google/Gemini keys start with "AI" and are 30-50 characters long.',
  },
  "fal.ai": {
    test: (k) => k.includes(":"),
    hint: 'fal.ai keys contain a ":" separator.',
  },
  fal: {
    test: (k) => k.includes(":"),
    hint: 'fal.ai keys contain a ":" separator.',
  },
};

/** Fallback: non-empty, no leading/trailing whitespace, no newlines. */
function genericFormatCheck(key: string): boolean {
  return key.length > 0 && key === key.trim() && !key.includes("\n") && !key.includes("\r");
}

function normalizeProvider(provider: string): string {
  return provider.toLowerCase().trim();
}

// ---------------------------------------------------------------------------
// Step 1 -- Format validation (instant, offline)
// ---------------------------------------------------------------------------

/**
 * Validate the format of an API key without any network calls.
 * Trims the key before checking. Returns immediately.
 */
export function validateKeyFormat(provider: string, key: string): KeyValidationResult {
  const pid = normalizeProvider(provider);
  const trimmed = key.trim();

  if (trimmed.length === 0) {
    return {
      valid: false,
      step: "format",
      provider: pid,
      error: "API key is empty.",
      hint: "Provide a non-empty API key.",
    };
  }

  const rule = FORMAT_RULES[pid];
  if (rule) {
    if (!rule.test(trimmed)) {
      return {
        valid: false,
        step: "format",
        provider: pid,
        error: `Key does not match expected ${pid} format.`,
        hint: rule.hint,
      };
    }
  } else {
    // Generic fallback
    if (!genericFormatCheck(trimmed)) {
      return {
        valid: false,
        step: "format",
        provider: pid,
        error: "Key contains invalid whitespace or newline characters.",
        hint: "Remove leading/trailing whitespace and newlines from the key.",
      };
    }
  }

  return { valid: true, step: "format", provider: pid };
}

// ---------------------------------------------------------------------------
// Step 2 -- Connectivity validation (lightweight API call)
// ---------------------------------------------------------------------------

/** Extract model id strings from an OpenAI-style /v1/models response. */
function parseOpenAiModels(body: unknown): string[] {
  if (typeof body !== "object" || body === null) {
    return [];
  }
  const data = (body as Record<string, unknown>).data;
  if (!Array.isArray(data)) {
    return [];
  }
  return data
    .map((m) =>
      typeof m === "object" && m !== null
        ? (() => {
            const v = (m as Record<string, unknown>).id;
            return typeof v === "string" ? v : "";
          })()
        : "",
    )
    .filter(Boolean);
}

/** Extract model names from a Gemini list-models response. */
function parseGeminiModels(body: unknown): string[] {
  if (typeof body !== "object" || body === null) {
    return [];
  }
  const models = (body as Record<string, unknown>).models;
  if (!Array.isArray(models)) {
    return [];
  }
  return models
    .map((m) =>
      typeof m === "object" && m !== null
        ? (() => {
            const v = (m as Record<string, unknown>).name;
            return typeof v === "string" ? v : "";
          })()
        : "",
    )
    .filter(Boolean);
}

/**
 * Validate that the key authenticates successfully against the provider API.
 * Makes one lightweight HTTP request. The key is trimmed before use.
 */
export async function validateKeyConnectivity(
  provider: string,
  key: string,
): Promise<KeyValidationResult> {
  const pid = normalizeProvider(provider);
  const trimmed = key.trim();

  try {
    switch (pid) {
      case "openai": {
        const res = await fetch("https://api.openai.com/v1/models", {
          method: "GET",
          headers: { Authorization: `Bearer ${trimmed}` },
        });
        if (!res.ok) {
          return {
            valid: false,
            step: "connectivity",
            provider: pid,
            error: `OpenAI API returned ${res.status}: ${res.statusText}`,
            hint: "Check that the key is active and has not been revoked.",
          };
        }
        const body: unknown = await res.json();
        return {
          valid: true,
          step: "connectivity",
          provider: pid,
          models: parseOpenAiModels(body),
        };
      }

      case "anthropic": {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": trimmed,
            "content-type": "application/json",
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1,
            messages: [{ role: "user", content: "hi" }],
          }),
        });
        // A 200 or 400 (bad request but authenticated) both prove the key works.
        // Only 401/403 indicate a bad key.
        if (res.status === 401 || res.status === 403) {
          return {
            valid: false,
            step: "connectivity",
            provider: pid,
            error: `Anthropic API returned ${res.status}: authentication failed.`,
            hint: "Check that the key is active and has correct permissions.",
          };
        }
        return { valid: true, step: "connectivity", provider: pid };
      }

      case "google":
      case "gemini": {
        const url = `https://generativelanguage.googleapis.com/v1/models?key=${encodeURIComponent(trimmed)}`;
        const res = await fetch(url, { method: "GET" });
        if (!res.ok) {
          return {
            valid: false,
            step: "connectivity",
            provider: pid,
            error: `Gemini API returned ${res.status}: ${res.statusText}`,
            hint: "Check that the key is valid and the Generative Language API is enabled.",
          };
        }
        const body: unknown = await res.json();
        return {
          valid: true,
          step: "connectivity",
          provider: pid,
          models: parseGeminiModels(body),
        };
      }

      case "fal.ai":
      case "fal": {
        const res = await fetch("https://rest.fal.run/auth/current", {
          method: "GET",
          headers: { Authorization: `Key ${trimmed}` },
        });
        if (!res.ok) {
          return {
            valid: false,
            step: "connectivity",
            provider: pid,
            error: `fal.ai API returned ${res.status}: ${res.statusText}`,
            hint: "Check that the key is valid.",
          };
        }
        return { valid: true, step: "connectivity", provider: pid };
      }

      default:
        return {
          valid: false,
          step: "connectivity",
          provider: pid,
          error: `No connectivity check implemented for provider "${pid}".`,
          hint: "Only openai, anthropic, google/gemini, and fal.ai are supported.",
        };
    }
  } catch (err) {
    return {
      valid: false,
      step: "connectivity",
      provider: pid,
      error: `Network error: ${err instanceof Error ? err.message : String(err)}`,
      hint: "Check your internet connection and try again.",
    };
  }
}

// ---------------------------------------------------------------------------
// Step 3 -- Full validation pipeline
// ---------------------------------------------------------------------------

/**
 * Run format validation followed by connectivity validation.
 * Short-circuits on format failure.
 */
export async function validateApiKey(provider: string, key: string): Promise<KeyValidationResult> {
  const formatResult = validateKeyFormat(provider, key);
  if (!formatResult.valid) {
    return formatResult;
  }
  return validateKeyConnectivity(provider, key);
}
