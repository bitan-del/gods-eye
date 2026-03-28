/**
 * Per-channel health check system for diagnosing channel connectivity issues.
 * Provides token validation, webhook checks, permission audits, and formatted reports.
 */

export interface DiagnosticCheck {
  name: string;
  passed: boolean;
  message: string;
  fixHint?: string;
  autoFixable: boolean;
}

export type ChannelStatus = "healthy" | "degraded" | "down";

export interface ChannelDiagnostic {
  channel: string;
  status: ChannelStatus;
  checks: DiagnosticCheck[];
  timestamp: number;
}

export interface ChannelConfig {
  tokenEnvVar: string;
  tokenPattern?: RegExp;
  requiredPermissions: string[];
}

/**
 * Known channel configurations for the five built-in channels.
 * Each entry defines the expected env var, optional token format, and required permissions.
 */
export const CHANNEL_CONFIGS: Record<string, ChannelConfig> = {
  telegram: {
    tokenEnvVar: "TELEGRAM_BOT_TOKEN",
    tokenPattern: /^\d+:[A-Za-z0-9_-]{35,}$/,
    requiredPermissions: ["send_messages", "read_messages", "send_media"],
  },
  discord: {
    tokenEnvVar: "DISCORD_BOT_TOKEN",
    tokenPattern: /^[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,}$/,
    requiredPermissions: ["SEND_MESSAGES", "READ_MESSAGE_HISTORY", "VIEW_CHANNEL", "EMBED_LINKS"],
  },
  slack: {
    tokenEnvVar: "SLACK_BOT_TOKEN",
    tokenPattern: /^xoxb-[0-9]+-[0-9A-Za-z-]+$/,
    requiredPermissions: ["chat:write", "channels:read", "channels:history", "users:read"],
  },
  whatsapp: {
    tokenEnvVar: "WHATSAPP_API_TOKEN",
    requiredPermissions: ["messages", "media", "contacts"],
  },
  signal: {
    tokenEnvVar: "SIGNAL_CLI_CONFIG",
    requiredPermissions: ["send", "receive"],
  },
};

/**
 * Verify that an auth token environment variable is set and non-empty.
 */
export function checkTokenPresent(
  channel: string,
  tokenEnvVar: string,
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): DiagnosticCheck {
  const value = env[tokenEnvVar];
  const present = typeof value === "string" && value.length > 0;

  if (present) {
    return {
      name: `${channel}:token-present`,
      passed: true,
      message: `Token env var ${tokenEnvVar} is set`,
      autoFixable: false,
    };
  }

  return {
    name: `${channel}:token-present`,
    passed: false,
    message: `Token env var ${tokenEnvVar} is not set or empty`,
    fixHint: `Set the ${tokenEnvVar} environment variable with a valid token`,
    autoFixable: false,
  };
}

/**
 * Verify that a token string matches an expected format pattern.
 */
export function checkTokenFormat(
  channel: string,
  token: string,
  expectedPattern?: RegExp,
): DiagnosticCheck {
  // If no pattern is provided, we can only check that the token is non-empty
  if (!expectedPattern) {
    const nonEmpty = token.length > 0;
    return {
      name: `${channel}:token-format`,
      passed: nonEmpty,
      message: nonEmpty
        ? `Token for ${channel} is non-empty (no format pattern to validate)`
        : `Token for ${channel} is empty`,
      autoFixable: false,
    };
  }

  const matches = expectedPattern.test(token);
  if (matches) {
    return {
      name: `${channel}:token-format`,
      passed: true,
      message: `Token for ${channel} matches expected format`,
      autoFixable: false,
    };
  }

  return {
    name: `${channel}:token-format`,
    passed: false,
    message: `Token for ${channel} does not match expected format`,
    fixHint: `Verify your ${channel} token is correct and hasn't been truncated`,
    autoFixable: false,
  };
}

/**
 * Verify that a webhook URL is syntactically valid and uses HTTPS.
 * Does not perform a network request; validates structure only.
 */
export function checkWebhookUrl(url: string): DiagnosticCheck {
  if (!url || url.trim().length === 0) {
    return {
      name: "webhook-url",
      passed: false,
      message: "Webhook URL is empty or missing",
      fixHint: "Provide a valid HTTPS webhook URL",
      autoFixable: false,
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {
      name: "webhook-url",
      passed: false,
      message: `Webhook URL is not a valid URL: ${url}`,
      fixHint: "Provide a well-formed URL starting with https://",
      autoFixable: false,
    };
  }

  if (parsed.protocol !== "https:") {
    return {
      name: "webhook-url",
      passed: false,
      message: `Webhook URL uses ${parsed.protocol} instead of https:`,
      fixHint: "Use an HTTPS URL for webhook endpoints",
      autoFixable: true,
    };
  }

  return {
    name: "webhook-url",
    passed: true,
    message: `Webhook URL is valid: ${parsed.origin}`,
    autoFixable: false,
  };
}

/**
 * Verify that required bot permissions are all present in the granted set.
 */
export function checkPermissions(
  channel: string,
  requiredPermissions: string[],
  grantedPermissions: string[],
): DiagnosticCheck {
  const grantedSet = new Set(grantedPermissions);
  const missing = requiredPermissions.filter((p) => !grantedSet.has(p));

  if (missing.length === 0) {
    return {
      name: `${channel}:permissions`,
      passed: true,
      message: `All ${requiredPermissions.length} required permissions are granted`,
      autoFixable: false,
    };
  }

  // Sort missing permissions alphabetically for deterministic output
  const sortedMissing = missing.toSorted();

  return {
    name: `${channel}:permissions`,
    passed: false,
    message: `Missing permissions: ${sortedMissing.join(", ")}`,
    fixHint: `Grant the following permissions to the ${channel} bot: ${sortedMissing.join(", ")}`,
    autoFixable: false,
  };
}

/**
 * Derive an overall status from a set of diagnostic checks.
 * - "healthy" when all checks pass
 * - "down" when all checks fail
 * - "degraded" when some pass and some fail
 */
export function aggregateStatus(checks: DiagnosticCheck[]): ChannelStatus {
  if (checks.length === 0) {
    return "healthy";
  }

  const passCount = checks.filter((c) => c.passed).length;

  if (passCount === checks.length) {
    return "healthy";
  }
  if (passCount === 0) {
    return "down";
  }
  return "degraded";
}

/**
 * Run a full diagnostic suite for a given channel using its known config.
 * Falls back to a minimal check if the channel is not in CHANNEL_CONFIGS.
 */
export function runChannelDiagnostics(
  channel: string,
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): ChannelDiagnostic {
  const config = CHANNEL_CONFIGS[channel];
  const checks: DiagnosticCheck[] = [];

  if (!config) {
    checks.push({
      name: `${channel}:unknown`,
      passed: false,
      message: `No known configuration for channel "${channel}"`,
      fixHint: `Register the channel in CHANNEL_CONFIGS or check spelling`,
      autoFixable: false,
    });

    return {
      channel,
      status: aggregateStatus(checks),
      checks,
      timestamp: Date.now(),
    };
  }

  // Check token presence
  const tokenCheck = checkTokenPresent(channel, config.tokenEnvVar, env);
  checks.push(tokenCheck);

  // Check token format (only if token is present)
  const tokenValue = env[config.tokenEnvVar];
  if (tokenCheck.passed && typeof tokenValue === "string") {
    checks.push(checkTokenFormat(channel, tokenValue, config.tokenPattern));
  }

  return {
    channel,
    status: aggregateStatus(checks),
    checks,
    timestamp: Date.now(),
  };
}

/**
 * Format a ChannelDiagnostic into a human-readable report string.
 */
export function formatDiagnosticReport(diagnostic: ChannelDiagnostic): string {
  const lines: string[] = [];
  const statusLabel = diagnostic.status.toUpperCase();
  lines.push(`Channel: ${diagnostic.channel} [${statusLabel}]`);
  lines.push("");

  for (const check of diagnostic.checks) {
    const mark = check.passed ? "\u2713" : "\u2717";
    lines.push(`  ${mark} ${check.name}: ${check.message}`);
    if (!check.passed && check.fixHint) {
      lines.push(`    Hint: ${check.fixHint}`);
    }
  }

  if (diagnostic.checks.length === 0) {
    lines.push("  No checks were executed.");
  }

  return lines.join("\n");
}
