import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export type NetworkExposureSeverity = "info" | "warn" | "critical";

export interface NetworkExposureFinding {
  severity: NetworkExposureSeverity;
  title: string;
  description: string;
  remediation: string;
}

const LOOPBACK_BINDS = new Set(["loopback", "127.0.0.1", "::1"]);

/** Check if gateway is bound to a non-loopback interface without TLS. */
export function checkBindSecurity(
  bind: string,
  tls?: { enabled: boolean },
): NetworkExposureFinding | null {
  const normalized = bind.trim().toLowerCase();

  if (LOOPBACK_BINDS.has(normalized)) {
    return null;
  }

  // "auto" defaults to loopback when available; treat it as safe.
  if (normalized === "auto") {
    return null;
  }

  if (tls?.enabled) {
    return null;
  }

  const isWildcard = normalized === "lan" || normalized === "0.0.0.0" || normalized === "::";

  return {
    severity: isWildcard ? "critical" : "warn",
    title: isWildcard
      ? "Gateway bound to all interfaces without TLS"
      : `Gateway bound to non-loopback address (${bind}) without TLS`,
    description: isWildcard
      ? "The gateway is listening on all network interfaces without TLS encryption. " +
        "Any device on the local network can intercept traffic in plaintext."
      : `The gateway is bound to ${bind} without TLS. Traffic may be intercepted on that interface.`,
    remediation:
      "Run `godseye config set gateway.bind loopback` to restrict to localhost, " +
      "or enable TLS: `godseye config set gateway.tls.enabled true`. " +
      "For secure remote access, use Tailscale instead of exposing ports.",
  };
}

/**
 * Check if the gateway port is listening on 0.0.0.0 (all interfaces).
 * Uses `ss` on Linux and `netstat` on macOS/Windows; silently returns
 * an empty array on platforms where neither command is available.
 */
export async function checkListeningInterfaces(port: number): Promise<NetworkExposureFinding[]> {
  const findings: NetworkExposureFinding[] = [];

  let output: string;
  try {
    // Try ss first (Linux), fall back to netstat (macOS/Windows/others).
    try {
      const result = await execAsync(`ss -tlnp sport = :${port}`, { timeout: 5_000 });
      output = result.stdout;
    } catch {
      const result = await execAsync("netstat -tlnp 2>/dev/null || netstat -an", {
        timeout: 5_000,
      });
      output = result.stdout;
    }
  } catch {
    // Neither command is available or failed; nothing we can report.
    return findings;
  }

  const portStr = `:${port}`;
  const lines = output.split("\n").filter((line) => line.includes(portStr));

  for (const line of lines) {
    if (line.includes("0.0.0.0" + portStr) || line.includes("*" + portStr)) {
      findings.push({
        severity: "warn",
        title: `Port ${port} is listening on all interfaces (0.0.0.0)`,
        description:
          `The gateway port ${port} is bound to 0.0.0.0, making it reachable from ` +
          "any network interface including public-facing ones.",
        remediation:
          "Run `godseye config set gateway.bind loopback` to restrict to localhost. " +
          "Use Tailscale for secure remote access instead of exposing ports.",
      });
      break;
    }
  }

  return findings;
}

/**
 * Check Docker port mappings for exposed gateway ports.
 * Parses `docker ps --format json` to detect containers that map the
 * gateway port to 0.0.0.0 (all host interfaces).
 */
export async function checkDockerExposure(): Promise<NetworkExposureFinding[]> {
  const findings: NetworkExposureFinding[] = [];

  let output: string;
  try {
    const result = await execAsync("docker ps --format '{{json .}}'", { timeout: 5_000 });
    output = result.stdout.trim();
  } catch {
    // Docker not installed or not running; nothing to check.
    return findings;
  }

  if (!output) {
    return findings;
  }

  for (const line of output.split("\n")) {
    if (!line.trim()) {
      continue;
    }
    try {
      const container = JSON.parse(line) as { Ports?: string; Names?: string };
      const ports = container.Ports ?? "";
      // Docker ports format: "0.0.0.0:18789->18789/tcp"
      if (ports.includes("0.0.0.0:") && /18789/.test(ports)) {
        findings.push({
          severity: "critical",
          title: `Docker container "${container.Names ?? "unknown"}" exposes gateway port on 0.0.0.0`,
          description:
            `Container ${container.Names ?? "unknown"} maps the gateway port to all host ` +
            "interfaces (0.0.0.0). This makes the gateway reachable from any network.",
          remediation:
            "Bind the Docker port to localhost: change the port mapping from " +
            '"18789:18789" to "127.0.0.1:18789:18789" in docker-compose.yml. ' +
            "Use Tailscale for secure remote access instead of exposing ports.",
        });
      }
    } catch {
      // Malformed JSON line; skip.
    }
  }

  return findings;
}

/** Run all network exposure checks. */
export async function auditNetworkExposure(config: {
  bind: string;
  port: number;
  tls?: { enabled: boolean };
}): Promise<NetworkExposureFinding[]> {
  const findings: NetworkExposureFinding[] = [];

  const bindFinding = checkBindSecurity(config.bind, config.tls);
  if (bindFinding) {
    findings.push(bindFinding);
  }

  const [interfaceFindings, dockerFindings] = await Promise.all([
    checkListeningInterfaces(config.port),
    checkDockerExposure(),
  ]);

  findings.push(...interfaceFindings);
  findings.push(...dockerFindings);

  return findings;
}
