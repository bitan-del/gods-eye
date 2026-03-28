/**
 * Unified auth error handling across all AI providers.
 * Classifies HTTP errors, provides provider-specific remediation hints,
 * and implements retry logic with exponential backoff + jitter.
 */

export type AuthErrorType =
  | "invalid_key"
  | "expired_key"
  | "insufficient_permissions"
  | "rate_limited"
  | "quota_exceeded"
  | "network_error"
  | "provider_down"
  | "unknown";

export interface AuthError {
  type: AuthErrorType;
  provider: string;
  httpStatus?: number;
  message: string;
  retryable: boolean;
  retryAfterMs?: number;
  hint: string;
}

const PROVIDER_KEY_URLS: Record<string, Record<string, string>> = {
  openai: {
    invalid_key: "Check your API key at https://platform.openai.com/api-keys",
    expired_key: "Generate a new key at https://platform.openai.com/api-keys",
    insufficient_permissions: "Review permissions at https://platform.openai.com/api-keys",
    rate_limited: "Check rate limits at https://platform.openai.com/account/limits",
    quota_exceeded: "Add billing credits at https://platform.openai.com/account/billing",
  },
  anthropic: {
    invalid_key: "Check your API key at https://console.anthropic.com/settings/keys",
    expired_key: "Generate a new key at https://console.anthropic.com/settings/keys",
    insufficient_permissions: "Review permissions at https://console.anthropic.com/settings/keys",
    rate_limited: "Check rate limits at https://console.anthropic.com/settings/limits",
    quota_exceeded: "Add billing credits at https://console.anthropic.com/settings/plans",
  },
  google: {
    invalid_key: "Check your API key at https://aistudio.google.com/apikey",
    expired_key: "Generate a new key at https://aistudio.google.com/apikey",
    insufficient_permissions: "Review permissions at https://aistudio.google.com/apikey",
    rate_limited: "Check quota at https://console.cloud.google.com/apis/dashboard",
    quota_exceeded: "Increase quota at https://console.cloud.google.com/apis/dashboard",
  },
  gemini: {
    invalid_key: "Check your API key at https://aistudio.google.com/apikey",
    expired_key: "Generate a new key at https://aistudio.google.com/apikey",
    insufficient_permissions: "Review permissions at https://aistudio.google.com/apikey",
    rate_limited: "Check quota at https://console.cloud.google.com/apis/dashboard",
    quota_exceeded: "Increase quota at https://console.cloud.google.com/apis/dashboard",
  },
  fal: {
    invalid_key: "Check your API key at https://fal.ai/dashboard/keys",
    expired_key: "Generate a new key at https://fal.ai/dashboard/keys",
    insufficient_permissions: "Review permissions at https://fal.ai/dashboard/keys",
    rate_limited: "Check usage at https://fal.ai/dashboard/billing",
    quota_exceeded: "Add credits at https://fal.ai/dashboard/billing",
  },
};

const DEFAULT_HINTS: Record<AuthErrorType, string> = {
  invalid_key: "Verify your API key is correct and has not been revoked.",
  expired_key: "Your API key has expired. Generate a new one.",
  insufficient_permissions: "Your API key lacks the required permissions for this operation.",
  rate_limited: "Too many requests. Wait before retrying.",
  quota_exceeded:
    "Your usage quota is exhausted. Add credits or wait for the billing cycle to reset.",
  network_error: "A network error occurred. Check your internet connection and try again.",
  provider_down: "The provider is experiencing issues. Check their status page and retry later.",
  unknown: "An unexpected error occurred. Check the provider dashboard for details.",
};

const RETRYABLE_TYPES = new Set<AuthErrorType>(["rate_limited", "network_error", "provider_down"]);

/** Base delay for exponential backoff in milliseconds. */
const BASE_RETRY_MS = 1000;

/** Maximum retry delay cap in milliseconds. */
const MAX_RETRY_MS = 60_000;

/**
 * Parse the Retry-After value from a response body or header string.
 * Supports integer seconds and RFC 7231 date formats.
 */
function parseRetryAfter(responseBody?: string): number | undefined {
  if (!responseBody) {
    return undefined;
  }

  // Try to find a Retry-After value in the response body (JSON or header-like)
  const retryAfterMatch =
    responseBody.match(/"retry[_-]?after"\s*:\s*"?(\d+)"?/i) ??
    responseBody.match(/Retry-After:\s*(\d+)/i);

  if (retryAfterMatch) {
    const seconds = Number.parseInt(retryAfterMatch[1], 10);
    if (!Number.isNaN(seconds) && seconds > 0) {
      return seconds * 1000;
    }
  }

  return undefined;
}

/**
 * Classify an HTTP error response into a structured AuthError.
 */
export function classifyAuthError(
  provider: string,
  httpStatus: number,
  responseBody?: string,
): AuthError {
  let type: AuthErrorType;
  let retryable = false;
  let retryAfterMs: number | undefined;

  if (httpStatus === 401) {
    type = "invalid_key";
  } else if (httpStatus === 403) {
    type = "insufficient_permissions";
  } else if (httpStatus === 429) {
    type = "rate_limited";
    retryable = true;
    retryAfterMs = parseRetryAfter(responseBody);
  } else if (httpStatus === 402) {
    type = "quota_exceeded";
  } else if (httpStatus >= 500 && httpStatus <= 503) {
    type = "provider_down";
    retryable = true;
  } else {
    type = "unknown";
  }

  const message = buildMessage(type, provider, httpStatus, responseBody);
  const hint = getProviderHint(provider, type);

  return {
    type,
    provider,
    httpStatus,
    message,
    retryable,
    retryAfterMs,
    hint,
  };
}

function buildMessage(
  type: AuthErrorType,
  provider: string,
  httpStatus: number,
  responseBody?: string,
): string {
  const prefix = `[${provider}] Auth error (HTTP ${httpStatus})`;

  // Try to extract a message from JSON response body
  if (responseBody) {
    try {
      const parsed = JSON.parse(responseBody);
      const extracted = parsed.error?.message ?? parsed.message ?? parsed.error;
      if (typeof extracted === "string" && extracted.length > 0) {
        return `${prefix}: ${extracted}`;
      }
    } catch {
      // Not JSON, fall through
    }
  }

  return `${prefix}: ${DEFAULT_HINTS[type]}`;
}

/**
 * Get a provider-specific remediation hint for the given error type.
 */
export function getProviderHint(provider: string, errorType: AuthErrorType): string {
  const normalizedProvider = provider.toLowerCase();
  const providerHints = PROVIDER_KEY_URLS[normalizedProvider];

  if (providerHints && providerHints[errorType]) {
    return providerHints[errorType];
  }

  return DEFAULT_HINTS[errorType];
}

/**
 * Check whether an AuthError is retryable.
 */
export function isRetryable(error: AuthError): boolean {
  return error.retryable || RETRYABLE_TYPES.has(error.type);
}

/**
 * Calculate retry delay with exponential backoff and jitter.
 * If the error has a retryAfterMs, that value is used as the minimum.
 */
export function getRetryDelay(error: AuthError, attempt: number): number {
  const exponentialDelay = BASE_RETRY_MS * 2 ** attempt;
  const jitter = Math.random() * BASE_RETRY_MS;
  let delay = exponentialDelay + jitter;

  if (error.retryAfterMs && error.retryAfterMs > delay) {
    delay = error.retryAfterMs;
  }

  return Math.min(delay, MAX_RETRY_MS);
}

/**
 * Format an AuthError into a human-friendly string.
 */
export function formatAuthError(error: AuthError): string {
  const lines: string[] = [];

  lines.push(`Provider: ${error.provider}`);
  lines.push(`Error: ${error.message}`);

  if (error.httpStatus !== undefined) {
    lines.push(`HTTP Status: ${error.httpStatus}`);
  }

  lines.push(`Type: ${error.type}`);
  lines.push(`Retryable: ${error.retryable ? "yes" : "no"}`);

  if (error.retryAfterMs !== undefined) {
    lines.push(`Retry after: ${Math.ceil(error.retryAfterMs / 1000)}s`);
  }

  lines.push(`Hint: ${error.hint}`);

  return lines.join("\n");
}

/**
 * Create an AuthError from a caught JS Error/exception.
 * Handles network errors (ECONNREFUSED, ETIMEDOUT, fetch failures) and
 * falls back to "unknown" for unrecognized exceptions.
 */
export function createAuthErrorFromException(provider: string, error: Error): AuthError {
  const msg = error.message.toLowerCase();

  // Detect common network error patterns
  const isNetworkError =
    msg.includes("econnrefused") ||
    msg.includes("etimedout") ||
    msg.includes("enotfound") ||
    msg.includes("fetch failed") ||
    msg.includes("network") ||
    msg.includes("socket hang up") ||
    msg.includes("econnreset");

  if (isNetworkError) {
    return {
      type: "network_error",
      provider,
      message: `[${provider}] Network error: ${error.message}`,
      retryable: true,
      hint: getProviderHint(provider, "network_error"),
    };
  }

  return {
    type: "unknown",
    provider,
    message: `[${provider}] Unexpected error: ${error.message}`,
    retryable: false,
    hint: getProviderHint(provider, "unknown"),
  };
}
