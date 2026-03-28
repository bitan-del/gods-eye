/**
 * Elm-style friendly error formatting for Gods Eye CLI.
 *
 * Renders structured, color-coded error messages with actionable hints
 * so users can self-diagnose common issues without searching docs.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FriendlyError {
  code: string;
  title: string;
  problem: string;
  hint: string;
  context?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// ANSI helpers (no external deps)
// ---------------------------------------------------------------------------

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";

// ---------------------------------------------------------------------------
// Error catalog
// ---------------------------------------------------------------------------

export const ERROR_CATALOG: Record<string, Omit<FriendlyError, "code">> = {
  E001: {
    title: "API key invalid format",
    problem:
      "The API key you provided does not match the expected format. Keys typically start with a provider-specific prefix (e.g. sk-) and contain only alphanumeric characters, hyphens, or underscores.",
    hint: 'Double-check that the key was copied in full (no trailing spaces or line breaks). You can re-enter it with "godseye config set provider.apiKey <key>".',
  },
  E002: {
    title: "API key authentication failed",
    problem:
      "The provider rejected your API key. This usually means the key has been revoked, expired, or belongs to a different account/project.",
    hint: 'Generate a fresh key from your provider dashboard and update it with "godseye config set provider.apiKey <key>". If you\'re using an organization key, make sure your account has access.',
  },
  E003: {
    title: "Gateway port in use",
    problem:
      "The gateway could not bind to the requested port because another process is already listening on it.",
    hint: 'Run "lsof -i :<port>" (macOS/Linux) or "netstat -ano | findstr :<port>" (Windows) to find the conflicting process, then free the port or choose a different one with --port.',
  },
  E004: {
    title: "Config file parse error",
    problem:
      "The configuration file contains invalid JSON or YAML and could not be parsed. This can happen after a manual edit introduces a syntax error.",
    hint: 'Run "godseye doctor" to validate your config, or open the file in an editor with JSON/YAML linting to find the syntax error.',
  },
  E005: {
    title: "Node version too old",
    problem:
      "Gods Eye requires Node.js 22 or newer, but your current Node version is older than that.",
    hint: 'Upgrade Node via your preferred version manager (nvm, fnm, volta) or download the latest LTS from https://nodejs.org. Run "node -v" to confirm.',
  },
  E006: {
    title: "Provider unreachable",
    problem:
      "A network request to the AI provider failed. This could be a DNS resolution failure, a firewall rule, or the provider is experiencing an outage.",
    hint: "Check your internet connection, proxy settings (HTTP_PROXY / HTTPS_PROXY), and the provider's status page. If you're behind a corporate firewall, ensure the provider domain is allowlisted.",
  },
  E007: {
    title: "Rate limit exceeded",
    problem:
      "The provider returned a 429 (Too Many Requests) response. You have hit the rate limit for your current plan or API tier.",
    hint: "Wait a few seconds and retry. If this happens frequently, consider upgrading your plan or adding request throttling. Check your provider dashboard for current usage and limits.",
  },
  E008: {
    title: "Token budget exhausted",
    problem:
      "The conversation or request exceeded the maximum token budget configured for this session.",
    hint: 'Reduce the input size, shorten the system prompt, or increase the budget with "godseye config set provider.maxTokens <value>". Splitting long tasks into smaller steps also helps.',
  },
  E009: {
    title: "Permission denied (tool blocked)",
    problem:
      "A tool execution was blocked by the current approval policy. The gateway refuses to run tools that have not been explicitly allowed.",
    hint: 'Review your approval policy with "godseye config get execApprovals" and add the tool to the allowlist if appropriate. You can also approve it interactively when prompted.',
  },
  E010: {
    title: "Channel connection failed",
    problem:
      "The gateway could not establish a connection to the messaging channel. The channel service may be down, credentials may be wrong, or the bot/integration was removed.",
    hint: 'Run "godseye channels status --probe" to diagnose the issue. Re-pair the channel with "godseye channels pair <channel>" if credentials have changed.',
  },
};

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Renders a FriendlyError into a multi-line, color-coded string suitable
 * for terminal output.
 */
export function formatFriendlyError(err: FriendlyError): string {
  const lines: string[] = [];

  // Header
  lines.push(`${RED}${BOLD}\u2717 [${err.code}] ${err.title}${RESET}`);
  lines.push("");

  // Problem
  lines.push(`${BOLD}Problem:${RESET}`);
  lines.push(`  ${err.problem}`);
  lines.push("");

  // Hint
  lines.push(`${YELLOW}${BOLD}Hint:${RESET}`);
  lines.push(`  ${CYAN}${err.hint}${RESET}`);

  // Context (optional)
  if (err.context && Object.keys(err.context).length > 0) {
    lines.push("");
    lines.push(`${DIM}Context:${RESET}`);
    for (const [key, value] of Object.entries(err.context)) {
      lines.push(`  ${DIM}${key}:${RESET} ${value}`);
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Wrapping
// ---------------------------------------------------------------------------

/** Heuristic patterns used by wrapError to auto-categorize standard Errors. */
const HEURISTIC_PATTERNS: Array<{ pattern: RegExp; code: string }> = [
  {
    pattern:
      /(?:invalid.*(?:api[_ ]?key|token|credential)|(?:api[_ ]?key|token|credential).*invalid)/i,
    code: "E001",
  },
  { pattern: /(?:unauthorized|401|authentication failed)/i, code: "E002" },
  { pattern: /EADDRINUSE|port.*(?:in use|already)/i, code: "E003" },
  { pattern: /(?:JSON|YAML|parse|syntax).*error/i, code: "E004" },
  { pattern: /node.*version|engine.*incompatible/i, code: "E005" },
  { pattern: /(?:ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network)/i, code: "E006" },
  { pattern: /(?:rate.limit|429|too many requests)/i, code: "E007" },
  { pattern: /(?:token.*budget|context.*length|max.*tokens)/i, code: "E008" },
  { pattern: /(?:permission denied|EACCES|tool.*blocked)/i, code: "E009" },
  { pattern: /(?:channel.*(?:fail|disconnect)|bot.*removed)/i, code: "E010" },
];

/**
 * Wraps a standard Error into a FriendlyError. If a matching catalog entry
 * is found via heuristic pattern matching on the error message, the catalog
 * fields are used as defaults. Callers can override any field.
 */
export function wrapError(error: Error, overrides?: Partial<FriendlyError>): FriendlyError {
  const message = error.message ?? String(error);

  // Attempt heuristic match
  let matched: { code: string; entry: Omit<FriendlyError, "code"> } | undefined;
  for (const { pattern, code } of HEURISTIC_PATTERNS) {
    if (pattern.test(message)) {
      const entry = ERROR_CATALOG[code];
      if (entry) {
        matched = { code, entry };
      }
      break;
    }
  }

  const base: FriendlyError = matched
    ? { code: matched.code, ...matched.entry }
    : {
        code: "E000",
        title: "Unexpected error",
        problem: message,
        hint: "If this persists, please file an issue at https://github.com/bitan-del/gods-eye/issues with the full error output.",
      };

  return {
    ...base,
    ...overrides,
    context: {
      ...base.context,
      originalMessage: message,
      ...overrides?.context,
    },
  };
}

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/** Returns the FriendlyError for a given code (e.g. "E003"), or undefined. */
export function lookupError(code: string): FriendlyError | undefined {
  const entry = ERROR_CATALOG[code];
  if (!entry) {
    return undefined;
  }
  return { code, ...entry };
}

/**
 * Fuzzy-searches the error catalog by matching the query against each
 * entry's title and problem text. Returns matching entries sorted by
 * relevance (number of matched query words, descending).
 */
export function suggestSimilarErrors(query: string): FriendlyError[] {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0);

  if (words.length === 0) {
    return [];
  }

  const scored: Array<{ error: FriendlyError; score: number }> = [];

  for (const [code, entry] of Object.entries(ERROR_CATALOG)) {
    const haystack = `${entry.title} ${entry.problem}`.toLowerCase();
    let score = 0;
    for (const word of words) {
      if (haystack.includes(word)) {
        score += 1;
      }
    }
    if (score > 0) {
      scored.push({ error: { code, ...entry }, score });
    }
  }

  return scored.toSorted((a, b) => b.score - a.score).map((s) => s.error);
}
