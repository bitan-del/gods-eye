/**
 * Detects locally installed CLI AI backends (Claude Code, Codex CLI, etc.)
 * and reports their availability, version, and capabilities.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type DetectedCliBinary = {
  id: string;
  command: string;
  available: boolean;
  version: string | null;
  path: string | null;
  /** Whether the binary supports MCP servers (--mcp-config). */
  mcpSupported: boolean;
  /** Whether the binary supports session resume. */
  sessionSupported: boolean;
};

export type CliDetectionResult = {
  backends: DetectedCliBinary[];
  /** Timestamp of detection. */
  detectedAt: number;
};

const CLI_BINARIES: Array<{
  id: string;
  command: string;
  versionArgs: string[];
  versionRegex: RegExp;
  mcpSupported: boolean;
  sessionSupported: boolean;
}> = [
  {
    id: "claude-cli",
    command: "claude",
    versionArgs: ["--version"],
    versionRegex: /(\d+\.\d+\.\d+)/,
    mcpSupported: true,
    sessionSupported: true,
  },
  {
    id: "codex-cli",
    command: "codex",
    versionArgs: ["--version"],
    versionRegex: /(\d+\.\d+\.\d+)/,
    mcpSupported: false,
    sessionSupported: true,
  },
];

async function whichCommand(command: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("which", [command], { timeout: 5000 });
    const path = stdout.trim();
    return path || null;
  } catch {
    return null;
  }
}

async function getVersion(command: string, args: string[], regex: RegExp): Promise<string | null> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, { timeout: 10000 });
    const output = (stdout || stderr).trim();
    const match = output.match(regex);
    return match?.[1] ?? output.split("\n")[0]?.trim() ?? null;
  } catch {
    return null;
  }
}

async function detectBinary(spec: (typeof CLI_BINARIES)[0]): Promise<DetectedCliBinary> {
  const path = await whichCommand(spec.command);
  if (!path) {
    return {
      id: spec.id,
      command: spec.command,
      available: false,
      version: null,
      path: null,
      mcpSupported: spec.mcpSupported,
      sessionSupported: spec.sessionSupported,
    };
  }
  const version = await getVersion(spec.command, spec.versionArgs, spec.versionRegex);
  return {
    id: spec.id,
    command: spec.command,
    available: true,
    version,
    path,
    mcpSupported: spec.mcpSupported,
    sessionSupported: spec.sessionSupported,
  };
}

/** Cached detection result (valid for 5 minutes). */
let cachedResult: CliDetectionResult | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Detect all known CLI AI backends. Results are cached for 5 minutes. */
export async function detectCliBackends(force = false): Promise<CliDetectionResult> {
  if (!force && cachedResult && Date.now() - cachedResult.detectedAt < CACHE_TTL_MS) {
    return cachedResult;
  }
  const backends = await Promise.all(CLI_BINARIES.map(detectBinary));
  const result: CliDetectionResult = {
    backends,
    detectedAt: Date.now(),
  };
  cachedResult = result;
  return result;
}

/** Quick check: is Claude Code CLI available? */
export async function isClaudeCodeAvailable(): Promise<boolean> {
  const result = await detectCliBackends();
  return result.backends.some((b) => b.id === "claude-cli" && b.available);
}
