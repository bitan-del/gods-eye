/**
 * 3-layer agent firewall inspired by Meta LlamaFirewall.
 * Intercepts agent actions at input, execution, and output layers.
 * Pure regex/string matching -- no external dependencies, no network calls.
 */

export type FirewallVerdict = "allow" | "warn" | "block";

export interface FirewallResult {
  verdict: FirewallVerdict;
  layer: "input" | "execution" | "output";
  reason?: string;
  details?: string;
}

// -- Layer 1: Input scanning --------------------------------------------------

/** Phrases that indicate prompt injection or goal hijacking. */
const INJECTION_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /ignore\s+(all\s+)?previous\s+(instructions?|prompts?|rules?)/i, label: "ignore-previous" },
  { re: /you\s+are\s+now\s+(a|an|the|my)\b/i, label: "role-override" },
  { re: /\bsystem\s*prompt\s*:/i, label: "system-prompt-inject" },
  { re: /\bIMPORTANT\s*:\s*override\b/i, label: "important-override" },
  {
    re: /\bdo\s+not\s+follow\s+(your|the|any)\s+(previous|original|system)\b/i,
    label: "directive-override",
  },
  {
    re: /\bdisregard\s+(all\s+)?(prior|previous|above)\s+(instructions?|context)\b/i,
    label: "disregard-prior",
  },
  { re: /\bnew\s+instructions?\s*:/i, label: "new-instructions" },
  {
    re: /\bforget\s+(everything|all|your)\s+(you|instructions?|rules?|training)\b/i,
    label: "forget-instructions",
  },
  { re: /\bjailbreak/i, label: "jailbreak-keyword" },
  { re: /\bDAN\s+mode\b/i, label: "dan-mode" },
];

/**
 * Attempt to detect base64-encoded injection payloads.
 * Looks for base64 blobs >= 20 chars and checks their decoded form.
 */
function containsEncodedInjection(input: string): { found: boolean; decoded?: string } {
  // Match base64 strings of at least 20 chars (likely meaningful payload)
  const b64Re = /[A-Za-z0-9+/]{20,}={0,2}/g;
  let match: RegExpExecArray | null;
  while ((match = b64Re.exec(input)) !== null) {
    try {
      const decoded = Buffer.from(match[0], "base64").toString("utf-8");
      // Only consider it valid if most chars are printable ASCII
      const printableRatio = decoded.replace(/[^ -~]/g, "").length / decoded.length;
      if (printableRatio < 0.8) {
        continue;
      }
      for (const pattern of INJECTION_PATTERNS) {
        if (pattern.re.test(decoded)) {
          return { found: true, decoded: decoded.slice(0, 200) };
        }
      }
    } catch {
      // Not valid base64 -- skip
    }
  }
  return { found: false };
}

/** Layer 1: Input scanning -- detect prompt injection and goal hijacking. */
export function scanInput(input: string): FirewallResult {
  // Direct injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.re.test(input)) {
      return {
        verdict: "block",
        layer: "input",
        reason: `Prompt injection detected: ${pattern.label}`,
        details: `Matched pattern "${pattern.label}" in input`,
      };
    }
  }

  // Encoded payload check
  const encoded = containsEncodedInjection(input);
  if (encoded.found) {
    return {
      verdict: "block",
      layer: "input",
      reason: "Encoded prompt injection detected in base64 payload",
      details: `Decoded content matched injection pattern: ${encoded.decoded}`,
    };
  }

  return { verdict: "allow", layer: "input" };
}

// -- Layer 2: Execution auditing -----------------------------------------------

/** Tools considered dangerous when used in certain sequences. */
const DANGEROUS_EXEC_TOOLS = new Set([
  "exec",
  "spawn",
  "shell",
  "sessions_spawn",
  "sessions_send",
  "fs_write",
  "fs_delete",
  "fs_move",
  "apply_patch",
]);

/** Tools that read potentially sensitive data. */
const SENSITIVE_READ_TOOLS = new Set(["fs_read", "read_file", "cat", "file_read"]);

/** Tools that can send data externally. */
const NETWORK_TOOLS = new Set([
  "http_request",
  "fetch",
  "curl",
  "webhook",
  "send_email",
  "send_message",
]);

/** Config/security modification tools. */
const PRIV_ESCALATION_TOOLS = new Set([
  "gateway",
  "config_set",
  "config_write",
  "cron",
  "permissions_set",
  "security_disable",
]);

/** Files/paths that are sensitive when read before network/exec calls. */
const SENSITIVE_FILE_PATTERNS = [
  /\.env/i,
  /credentials?/i,
  /\.ssh\//i,
  /\.aws\//i,
  /\.gnupg\//i,
  /secret/i,
  /token/i,
  /\.npmrc/i,
  /\.netrc/i,
  /id_rsa/i,
  /id_ed25519/i,
];

function extractKeywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
}

function detectExfiltrationUrl(args: Record<string, unknown>): string | undefined {
  const raw = args.url ?? args.endpoint ?? args.webhook ?? args.uri ?? "";
  const url = typeof raw === "string" ? raw : JSON.stringify(raw);
  if (!url || url === "undefined") {
    return undefined;
  }
  // Flag external URLs (non-localhost, non-loopback)
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    if (host !== "localhost" && host !== "127.0.0.1" && host !== "::1" && host !== "0.0.0.0") {
      return url;
    }
  } catch {
    // Not a valid URL -- ignore
  }
  return undefined;
}

/** Layer 2: Execution auditing -- check tool calls for misalignment and danger. */
export function auditToolCall(context: {
  originalObjective: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
  callHistory: Array<{ tool: string; result: string }>;
}): FirewallResult {
  const { originalObjective, toolName, toolArgs, callHistory } = context;
  const normalizedTool = toolName.toLowerCase().replace(/[-\s]/g, "_");

  // Privilege escalation check
  if (PRIV_ESCALATION_TOOLS.has(normalizedTool)) {
    return {
      verdict: "block",
      layer: "execution",
      reason: `Privilege escalation attempt: tool "${toolName}" modifies security/config`,
      details: `Tool "${toolName}" is in the privilege escalation blocklist`,
    };
  }

  // Exfiltration URL detection
  const exfilUrl = detectExfiltrationUrl(toolArgs);
  if (exfilUrl && NETWORK_TOOLS.has(normalizedTool)) {
    // Check if the URL was part of the original objective
    if (!originalObjective.includes(exfilUrl)) {
      return {
        verdict: "warn",
        layer: "execution",
        reason: `Potential data exfiltration: "${toolName}" targets external URL not in original request`,
        details: `URL: ${exfilUrl}`,
      };
    }
  }

  // Dangerous sequence: sensitive file read followed by exec/network tool
  const recentSensitiveRead = callHistory.some((call) => {
    const prevTool = call.tool.toLowerCase().replace(/[-\s]/g, "_");
    return (
      SENSITIVE_READ_TOOLS.has(prevTool) &&
      SENSITIVE_FILE_PATTERNS.some((re) => re.test(call.result))
    );
  });

  if (
    recentSensitiveRead &&
    (DANGEROUS_EXEC_TOOLS.has(normalizedTool) || NETWORK_TOOLS.has(normalizedTool))
  ) {
    return {
      verdict: "block",
      layer: "execution",
      reason: `Dangerous sequence: sensitive file was read before "${toolName}" call`,
      details: "A sensitive file (credentials, keys, .env) was accessed earlier in this session",
    };
  }

  // Objective drift: check if tool name/args have any keyword overlap with objective
  if (originalObjective.length > 0) {
    const objectiveKeywords = extractKeywords(originalObjective);
    const toolKeywords = extractKeywords(`${toolName} ${JSON.stringify(toolArgs)}`);
    const overlap = [...toolKeywords].filter((k) => objectiveKeywords.has(k));
    // Only flag drift for exec/network tools with zero overlap
    if (
      overlap.length === 0 &&
      (DANGEROUS_EXEC_TOOLS.has(normalizedTool) || NETWORK_TOOLS.has(normalizedTool)) &&
      callHistory.length > 2
    ) {
      return {
        verdict: "warn",
        layer: "execution",
        reason: `Possible objective drift: "${toolName}" has no keyword overlap with original request`,
        details: `Objective keywords: ${[...objectiveKeywords].slice(0, 10).join(", ")}`,
      };
    }
  }

  return { verdict: "allow", layer: "execution" };
}

// -- Layer 3: Output scanning --------------------------------------------------

/** Patterns that match sensitive data in output. */
const SENSITIVE_OUTPUT_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bsk-[A-Za-z0-9]{20,}/g, label: "API key (sk-*)" },
  { re: /\bghp_[A-Za-z0-9]{36,}/g, label: "GitHub token" },
  { re: /\bglpat-[A-Za-z0-9-]{20,}/g, label: "GitLab token" },
  { re: /\bAIza[A-Za-z0-9_-]{35}/g, label: "Google API key" },
  { re: /\bAKIA[A-Z0-9]{16}/g, label: "AWS access key" },
  { re: /\bxox[bpras]-[A-Za-z0-9-]+/g, label: "Slack token" },
  { re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, label: "JWT token" },
  // Sensitive file paths
  { re: /~\/\.ssh\/[^\s"')]+/g, label: "SSH key path" },
  { re: /~\/\.aws\/[^\s"')]+/g, label: "AWS config path" },
  { re: /~\/\.gnupg\/[^\s"')]+/g, label: "GPG key path" },
];

/** Patterns for potential XSS or code execution in rendered output. */
const XSS_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /<script\b[^>]*>[\s\S]*?<\/script>/gi, label: "script-tag" },
  { re: /\bon\w+\s*=\s*["'][^"']*["']/gi, label: "inline-event-handler" },
  { re: /javascript\s*:/gi, label: "javascript-uri" },
  { re: /data\s*:\s*text\/html/gi, label: "data-uri-html" },
];

/** Detect URLs that could be exfiltration endpoints embedded in output. */
const EXFIL_URL_RE = /https?:\/\/[^\s"'<>]+/gi;

/** Layer 3: Output scanning -- detect sensitive data leaks and XSS. */
export function scanOutput(output: string): FirewallResult {
  // Sensitive data detection
  for (const pattern of SENSITIVE_OUTPUT_PATTERNS) {
    // Reset lastIndex for global regexes
    pattern.re.lastIndex = 0;
    if (pattern.re.test(output)) {
      return {
        verdict: "block",
        layer: "output",
        reason: `Sensitive data in output: ${pattern.label}`,
        details: `Output contains ${pattern.label}`,
      };
    }
  }

  // XSS pattern detection
  for (const pattern of XSS_PATTERNS) {
    pattern.re.lastIndex = 0;
    if (pattern.re.test(output)) {
      return {
        verdict: "warn",
        layer: "output",
        reason: `Potential XSS in output: ${pattern.label}`,
        details: `Output contains ${pattern.label} pattern that could execute on rendering`,
      };
    }
  }

  // Embedded exfiltration URLs: flag if output contains URLs with query params
  // that look like they carry data (long query strings)
  EXFIL_URL_RE.lastIndex = 0;
  let urlMatch: RegExpExecArray | null;
  while ((urlMatch = EXFIL_URL_RE.exec(output)) !== null) {
    const url = urlMatch[0];
    try {
      const parsed = new URL(url);
      // Flag URLs with suspiciously long query params (potential data exfiltration)
      if (parsed.search.length > 200) {
        return {
          verdict: "warn",
          layer: "output",
          reason: "Suspicious URL with long query parameters in output",
          details: `URL may be exfiltrating data: ${url.slice(0, 100)}...`,
        };
      }
    } catch {
      // Not a valid URL -- skip
    }
  }

  return { verdict: "allow", layer: "output" };
}

// -- Combined firewall check ---------------------------------------------------

/** Run all applicable layers for a complete firewall check. */
export function firewallCheck(params: {
  input?: string;
  toolCall?: { name: string; args: Record<string, unknown> };
  output?: string;
  context?: {
    originalObjective: string;
    callHistory: Array<{ tool: string; result: string }>;
  };
}): FirewallResult[] {
  const results: FirewallResult[] = [];

  if (params.input !== undefined) {
    results.push(scanInput(params.input));
  }

  if (params.toolCall && params.context) {
    results.push(
      auditToolCall({
        originalObjective: params.context.originalObjective,
        toolName: params.toolCall.name,
        toolArgs: params.toolCall.args,
        callHistory: params.context.callHistory,
      }),
    );
  }

  if (params.output !== undefined) {
    results.push(scanOutput(params.output));
  }

  return results;
}
