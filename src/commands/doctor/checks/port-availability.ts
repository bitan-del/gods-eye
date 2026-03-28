import net from "node:net";
import type { CheckResult, DoctorCheck } from "../check-framework.js";

/** Default ports used by the gateway and bridge. */
const PORTS = [
  { port: 18789, label: "Gateway" },
  { port: 18790, label: "Bridge" },
];

/**
 * Try to bind a TCP server to the given port.
 * Resolves true if the port is free, false if already in use.
 */
function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => {
      // Port is already in use (EADDRINUSE or similar).
      resolve(false);
    });
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

export class PortAvailabilityCheck implements DoctorCheck {
  name = "Port Availability";
  category = "network" as const;

  async check(): Promise<CheckResult> {
    const results = await Promise.all(
      PORTS.map(async ({ port, label }) => ({
        port,
        label,
        free: await isPortFree(port),
      })),
    );

    const busy = results.filter((r) => !r.free);

    if (busy.length === 0) {
      return {
        status: "pass",
        message: `Ports ${PORTS.map((p) => p.port).join(", ")} are available`,
        detail: results.map((r) => `${r.label} (${r.port}): free`).join("; "),
      };
    }

    const busyLabels = busy.map((b) => `${b.label} (${b.port})`).join(", ");
    // Warn rather than fail because the gateway might already be running.
    return {
      status: "warn",
      message: `Ports in use: ${busyLabels}`,
      detail: "These ports may be occupied by a running gateway or another process.",
      fixHint: `Check with \`lsof -i :${busy[0].port}\` or stop the existing process`,
    };
  }
}
