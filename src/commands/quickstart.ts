/**
 * `godseye quickstart` — interactive bootstrap that detects the local
 * environment, validates prerequisites, collects provider credentials,
 * writes an initial config, and starts the gateway.
 */

import { execSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { homedir, platform, release, type } from "node:os";
import { join } from "node:path";
import { validateKeyFormat } from "../config/api-key-validation.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QuickstartOptions {
  /** Skip prerequisite checks (Node version, port availability). */
  skipChecks?: boolean;
  /** Pre-select a provider so the prompt is skipped. */
  provider?: string;
}

export interface EnvironmentInfo {
  os: string;
  osRelease: string;
  nodeVersion: string;
  nodeMajor: number;
  dockerAvailable: boolean;
  existingConfig: boolean;
}

export interface PrerequisiteResult {
  passed: boolean;
  failures: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPPORTED_PROVIDERS = ["anthropic", "gemini", "openai"] as const;
export type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

const REQUIRED_NODE_MAJOR = 22;
const GATEWAY_PORTS = [18789, 18790] as const;

const CONFIG_DIR = join(homedir(), ".godseye");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

// ---------------------------------------------------------------------------
// Environment detection
// ---------------------------------------------------------------------------

export function detectEnvironment(): EnvironmentInfo {
  const nodeVersion = process.version;
  const nodeMajor = Number.parseInt(nodeVersion.slice(1), 10);

  let dockerAvailable = false;
  try {
    execSync("docker --version", { stdio: "ignore" });
    dockerAvailable = true;
  } catch {
    // Docker not installed or not in PATH — that is fine.
  }

  let existingConfig = false;
  try {
    // Synchronous check keeps the function sync and simple.
    // eslint-disable-next-line n/no-sync
    require("node:fs").accessSync(CONFIG_PATH);
    existingConfig = true;
  } catch {
    // No existing config.
  }

  return {
    os: `${type()} ${platform()}`,
    osRelease: release(),
    nodeVersion,
    nodeMajor,
    dockerAvailable,
    existingConfig,
  };
}

// ---------------------------------------------------------------------------
// Port helpers
// ---------------------------------------------------------------------------

export function checkPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.once("error", () => {
      resolve(false);
    });
    srv.listen(port, "127.0.0.1", () => {
      srv.close(() => {
        resolve(true);
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Prerequisite checks
// ---------------------------------------------------------------------------

export async function checkPrerequisites(
  env: EnvironmentInfo,
  portChecker: (port: number) => Promise<boolean> = checkPortFree,
): Promise<PrerequisiteResult> {
  const failures: string[] = [];

  if (env.nodeMajor < REQUIRED_NODE_MAJOR) {
    failures.push(`Node.js >= ${REQUIRED_NODE_MAJOR} is required (detected ${env.nodeVersion}).`);
  }

  for (const port of GATEWAY_PORTS) {
    const free = await portChecker(port);
    if (!free) {
      failures.push(`Port ${port} is already in use.`);
    }
  }

  return { passed: failures.length === 0, failures };
}

// ---------------------------------------------------------------------------
// Provider helpers
// ---------------------------------------------------------------------------

export function isSupportedProvider(value: string): value is SupportedProvider {
  return (SUPPORTED_PROVIDERS as readonly string[]).includes(value.toLowerCase());
}

export function normalizeProvider(value: string): SupportedProvider {
  const lower = value.toLowerCase();
  if (!isSupportedProvider(lower)) {
    throw new Error(
      `Unsupported provider "${value}". Choose one of: ${SUPPORTED_PROVIDERS.join(", ")}`,
    );
  }
  return lower;
}

export function getSupportedProviders(): readonly string[] {
  return SUPPORTED_PROVIDERS;
}

// ---------------------------------------------------------------------------
// Config generation
// ---------------------------------------------------------------------------

export interface GeneratedConfig {
  provider: SupportedProvider;
  apiKey: string;
  gateway: { mode: string; bind: string };
}

export function buildConfig(provider: SupportedProvider, apiKey: string): GeneratedConfig {
  return {
    provider,
    apiKey,
    gateway: { mode: "local", bind: "loopback" },
  };
}

export async function writeConfig(config: GeneratedConfig): Promise<string> {
  await mkdir(CONFIG_DIR, { recursive: true });
  const json = JSON.stringify(config, null, 2) + "\n";
  await writeFile(CONFIG_PATH, json, "utf-8");
  return CONFIG_PATH;
}

export async function readExistingConfig(): Promise<string | null> {
  try {
    return await readFile(CONFIG_PATH, "utf-8");
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Gateway launch
// ---------------------------------------------------------------------------

export function startGateway(): void {
  execSync("godseye gateway run --bind loopback", {
    stdio: "inherit",
  });
}

// ---------------------------------------------------------------------------
// Success summary
// ---------------------------------------------------------------------------

export function formatSuccessSummary(provider: SupportedProvider, configPath: string): string {
  const lines = [
    "",
    "Gods Eye quickstart complete!",
    "",
    `  Provider : ${provider}`,
    `  Config   : ${configPath}`,
    `  Gateway  : running on loopback (ports ${GATEWAY_PORTS.join(", ")})`,
    "",
    "Next steps:",
    "  1. godseye channels status   — verify channel health",
    "  2. godseye doctor            — run full diagnostics",
    "  3. godseye message send      — send a test message",
    "",
  ];
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function runQuickstart(options: QuickstartOptions = {}): Promise<void> {
  const env = detectEnvironment();

  console.log(`Detected: ${env.os} (${env.osRelease}), Node ${env.nodeVersion}`);
  if (env.dockerAvailable) {
    console.log("Docker: available");
  }
  if (env.existingConfig) {
    console.log(`Existing config found at ${CONFIG_PATH}`);
  }

  // --- prerequisites ---
  if (!options.skipChecks) {
    const prereqs = await checkPrerequisites(env);
    if (!prereqs.passed) {
      for (const f of prereqs.failures) {
        console.error(`[FAIL] ${f}`);
      }
      throw new Error("Prerequisite checks failed. Use --skip-checks to bypass.");
    }
    console.log("All prerequisite checks passed.");
  }

  // --- provider ---
  const provider = normalizeProvider(options.provider ?? SUPPORTED_PROVIDERS[0]);

  // --- API key (placeholder for interactive prompt in real CLI wiring) ---
  const apiKey = process.env[`${provider.toUpperCase()}_API_KEY`] ?? "";
  const keyResult = validateKeyFormat(provider, apiKey);
  if (!keyResult.valid) {
    throw new Error(
      `Invalid API key for ${provider}: ${keyResult.error ?? "unknown format error"}${keyResult.hint ? ` (${keyResult.hint})` : ""}`,
    );
  }

  // --- config ---
  const config = buildConfig(provider, apiKey);
  const path = await writeConfig(config);
  console.log(`Config written to ${path}`);

  // --- gateway ---
  try {
    startGateway();
  } catch {
    console.error(
      "Gateway failed to start — you can retry with: godseye gateway run --bind loopback",
    );
  }

  // --- summary ---
  console.log(formatSuccessSummary(provider, path));
}
