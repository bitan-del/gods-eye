import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export type SupplyChainSeverity = "info" | "warn" | "critical";

export type SupplyChainFinding = {
  severity: SupplyChainSeverity;
  tool: string;
  title: string;
  description: string;
  evidence?: string;
};

/** SHA-256 hash a file or string for integrity verification. */
export function sha256(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

/** Verify a downloaded package against an expected hash. */
export function verifyIntegrity(content: Buffer, expectedHash: string): boolean {
  return sha256(content) === expectedHash.toLowerCase().replace(/^sha256:/, "");
}

// Prompt injection phrases (case-insensitive).
const INJECTION_PHRASES: Array<{ pattern: RegExp; title: string }> = [
  {
    pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/i,
    title: "Prompt injection: ignore previous instructions",
  },
  {
    pattern: /you\s+are\s+now\s+(a|an)\s+/i,
    title: "Prompt injection: role reassignment",
  },
  {
    pattern: /^\s*system\s*:/im,
    title: "Prompt injection: fake system message",
  },
  {
    pattern: /\bIMPORTANT\s*:\s*.{0,20}(override|ignore|forget|disregard)/i,
    title: "Prompt injection: IMPORTANT override directive",
  },
  {
    pattern: /forget\s+(your|all|every)\s+(rules?|guidelines?|instructions?)/i,
    title: "Prompt injection: forget rules directive",
  },
  {
    pattern: /\boverride\b.{0,30}\b(safety|security|rules?|policy|guidelines?)\b/i,
    title: "Prompt injection: safety override attempt",
  },
  {
    pattern: /\bnew\s+instructions?\s*:/i,
    title: "Prompt injection: new instructions block",
  },
];

// Unicode tricks — zero-width characters, RTL override, homoglyphs.
const ZERO_WIDTH_RE = /[\u200B\u200C\u2060\uFEFF]/;
const RTL_OVERRIDE_RE = /[\u202E\u202D\u200F\u200E\u2066\u2067\u2068\u2069]/;
// Hidden content in markdown / HTML comments.
const MD_HTML_COMMENT_RE = /<!--[\s\S]*?-->/;
const MD_LINK_COMMENT_RE = /\[\/\/\]\s*:\s*#\s*\(/;
// Base64 payload detection — long base64 blocks that look like encoded instructions.
const BASE64_PAYLOAD_RE = /(?:atob|Buffer\.from)\s*\(\s*["'][A-Za-z0-9+/=]{60,}["']/;
const STANDALONE_BASE64_RE = /[A-Za-z0-9+/=]{100,}/;
// Tool poisoning: description that references invoking other tools.
const TOOL_POISONING_RE =
  /\b(call|invoke|execute|run|use)\s+(the\s+)?(tool|function|command)\s+["'`]?[a-zA-Z_]/i;
// Suspicious external URLs in tool configs.
const SUSPICIOUS_URL_RE = /https?:\/\/(?!localhost|127\.0\.0\.1)[^\s"'`<>]+/i;

const SEVERITY_ORDER: Record<SupplyChainSeverity, number> = { critical: 0, warn: 1, info: 2 };

function sortFindings(findings: SupplyChainFinding[]): SupplyChainFinding[] {
  return findings.toSorted((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

function truncate(text: string, max = 120): string {
  return text.length <= max ? text : `${text.slice(0, max)}...`;
}

function pushFinding(
  out: SupplyChainFinding[],
  f: Omit<SupplyChainFinding, "evidence"> & { evidence?: string },
): void {
  out.push(f as SupplyChainFinding);
}

// Shared injection + unicode checks used by both scanToolDescription and scanSkillFile.
function scanInjectionAndUnicode(
  toolName: string,
  text: string,
  label: string,
  findings: SupplyChainFinding[],
): void {
  for (const rule of INJECTION_PHRASES) {
    const match = rule.pattern.exec(text);
    if (match) {
      pushFinding(findings, {
        severity: "critical",
        tool: toolName,
        title: rule.title,
        description: `${label} contains suspicious instruction: "${truncate(match[0])}"`,
        evidence: truncate(match[0]),
      });
    }
  }
  if (ZERO_WIDTH_RE.test(text)) {
    pushFinding(findings, {
      severity: "warn",
      tool: toolName,
      title: `Unicode: zero-width characters ${label === "Tool description" ? "detected" : "in skill file"}`,
      description: `${label} contains invisible zero-width characters${label === "Tool description" ? " that may hide content" : ""}`,
    });
  }
  if (RTL_OVERRIDE_RE.test(text)) {
    pushFinding(findings, {
      severity: "critical",
      tool: toolName,
      title: `Unicode: RTL override ${label === "Tool description" ? "characters detected" : "in skill file"}`,
      description: `${label} contains bidirectional text override characters${label === "Tool description" ? " that can visually mask content" : ""}`,
    });
  }
}

/** Check a tool description for hidden prompt injection patterns. */
export function scanToolDescription(toolName: string, description: string): SupplyChainFinding[] {
  const findings: SupplyChainFinding[] = [];
  scanInjectionAndUnicode(toolName, description, "Tool description", findings);

  if (MD_HTML_COMMENT_RE.test(description)) {
    pushFinding(findings, {
      severity: "warn",
      tool: toolName,
      title: "Hidden HTML/markdown comment block",
      description: "Tool description contains comment blocks that may hide instructions from users",
    });
  }
  if (MD_LINK_COMMENT_RE.test(description)) {
    pushFinding(findings, {
      severity: "warn",
      tool: toolName,
      title: "Hidden markdown link comment",
      description:
        "Tool description contains markdown link-style comment that may hide instructions",
    });
  }
  if (BASE64_PAYLOAD_RE.test(description)) {
    pushFinding(findings, {
      severity: "critical",
      tool: toolName,
      title: "Base64-encoded payload with decode call",
      description: "Tool description contains a Base64 decode call with a large payload",
    });
  }
  if (TOOL_POISONING_RE.test(description)) {
    pushFinding(findings, {
      severity: "warn",
      tool: toolName,
      title: "Tool poisoning: references invoking other tools",
      description:
        "Tool description instructs the model to call other tools, a tool-chain poisoning signal",
    });
  }
  return sortFindings(findings);
}

/** Check a SKILL.md file for suspicious patterns. */
export function scanSkillFile(toolName: string, content: string): SupplyChainFinding[] {
  const findings: SupplyChainFinding[] = [];
  scanInjectionAndUnicode(toolName, content, "Skill file", findings);

  if (STANDALONE_BASE64_RE.test(content) && BASE64_PAYLOAD_RE.test(content)) {
    pushFinding(findings, {
      severity: "critical",
      tool: toolName,
      title: "Base64-encoded payload in skill file",
      description: "Skill file contains a Base64 decode call with a large encoded payload",
    });
  }
  const urlMatches = content.match(new RegExp(SUSPICIOUS_URL_RE.source, "gi"));
  if (urlMatches && urlMatches.length > 5) {
    pushFinding(findings, {
      severity: "info",
      tool: toolName,
      title: "Multiple external URLs in skill file",
      description: `Skill file references ${urlMatches.length} external URLs — review for unexpected domains`,
    });
  }
  if (MD_HTML_COMMENT_RE.test(content)) {
    pushFinding(findings, {
      severity: "warn",
      tool: toolName,
      title: "Hidden comment block in skill file",
      description: "Skill file contains HTML/markdown comment blocks that may hide instructions",
    });
  }
  return sortFindings(findings);
}

/** Run full supply chain audit on installed skills/tools in a directory. */
export async function auditSupplyChain(skillsDir: string): Promise<SupplyChainFinding[]> {
  const findings: SupplyChainFinding[] = [];
  let entries: string[];
  try {
    entries = await fs.readdir(skillsDir);
  } catch {
    return [];
  }
  for (const entry of entries) {
    const skillPath = path.join(skillsDir, entry);
    const stat = await fs.stat(skillPath).catch(() => null);
    if (!stat?.isDirectory()) {
      continue;
    }
    const skillMdPath = path.join(skillPath, "SKILL.md");
    try {
      const content = await fs.readFile(skillMdPath, "utf-8");
      findings.push(...scanSkillFile(entry, content));
    } catch {
      // No SKILL.md — not an error
    }
  }
  return sortFindings(findings);
}
