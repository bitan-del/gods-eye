import { exec } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  auditNetworkExposure,
  checkBindSecurity,
  checkDockerExposure,
  checkListeningInterfaces,
} from "./network-exposure.js";

vi.mock("node:child_process", () => ({
  exec: vi.fn(),
}));

vi.mock("node:util", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:util")>();
  return {
    ...actual,
    promisify: vi.fn((fn: unknown) => fn),
  };
});

const mockExec = vi.mocked(exec) as unknown as ReturnType<typeof vi.fn>;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("checkBindSecurity", () => {
  it("returns null for loopback binding", () => {
    expect(checkBindSecurity("loopback")).toBeNull();
    expect(checkBindSecurity("127.0.0.1")).toBeNull();
    expect(checkBindSecurity("::1")).toBeNull();
  });

  it("returns null for auto binding", () => {
    expect(checkBindSecurity("auto")).toBeNull();
  });

  it("returns critical for lan binding without TLS", () => {
    const finding = checkBindSecurity("lan");
    expect(finding).not.toBeNull();
    expect(finding!.severity).toBe("critical");
    expect(finding!.title).toContain("all interfaces without TLS");
  });

  it("returns critical for 0.0.0.0 binding without TLS", () => {
    const finding = checkBindSecurity("0.0.0.0");
    expect(finding).not.toBeNull();
    expect(finding!.severity).toBe("critical");
  });

  it("returns null for lan binding with TLS enabled", () => {
    expect(checkBindSecurity("lan", { enabled: true })).toBeNull();
    expect(checkBindSecurity("0.0.0.0", { enabled: true })).toBeNull();
  });

  it("returns warn for custom non-loopback binding without TLS", () => {
    const finding = checkBindSecurity("192.168.1.100");
    expect(finding).not.toBeNull();
    expect(finding!.severity).toBe("warn");
    expect(finding!.description).toContain("192.168.1.100");
  });

  it("returns null for custom binding with TLS", () => {
    expect(checkBindSecurity("192.168.1.100", { enabled: true })).toBeNull();
  });

  it("includes remediation steps", () => {
    const finding = checkBindSecurity("lan");
    expect(finding).not.toBeNull();
    expect(finding!.remediation).toContain("godseye config set gateway.bind loopback");
    expect(finding!.remediation).toContain("Tailscale");
  });
});

describe("checkListeningInterfaces", () => {
  it("returns finding when port listens on 0.0.0.0", async () => {
    mockExec.mockImplementation((_cmd: string, _opts: unknown) =>
      Promise.resolve({
        stdout:
          "State  Recv-Q Send-Q  Local Address:Port  Peer Address:Port\n" +
          "LISTEN 0      128     0.0.0.0:18789       0.0.0.0:*\n",
        stderr: "",
      }),
    );

    const findings = await checkListeningInterfaces(18789);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("warn");
    expect(findings[0].title).toContain("18789");
  });

  it("returns empty when port listens on 127.0.0.1", async () => {
    mockExec.mockImplementation((_cmd: string, _opts: unknown) =>
      Promise.resolve({
        stdout:
          "State  Recv-Q Send-Q  Local Address:Port  Peer Address:Port\n" +
          "LISTEN 0      128     127.0.0.1:18789     0.0.0.0:*\n",
        stderr: "",
      }),
    );

    const findings = await checkListeningInterfaces(18789);
    expect(findings).toHaveLength(0);
  });

  it("returns empty when command fails", async () => {
    mockExec.mockImplementation(() => Promise.reject(new Error("command not found")));

    const findings = await checkListeningInterfaces(18789);
    expect(findings).toHaveLength(0);
  });

  it("falls back to netstat when ss fails", async () => {
    let callCount = 0;
    mockExec.mockImplementation((_cmd: string, _opts: unknown) => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error("ss not found"));
      }
      return Promise.resolve({
        stdout: "tcp  0  0  127.0.0.1:18789  0.0.0.0:*  LISTEN\n",
        stderr: "",
      });
    });

    const findings = await checkListeningInterfaces(18789);
    expect(callCount).toBe(2);
    expect(findings).toHaveLength(0);
  });
});

describe("checkDockerExposure", () => {
  it("detects container exposing gateway port on 0.0.0.0", async () => {
    mockExec.mockImplementation((_cmd: string, _opts: unknown) =>
      Promise.resolve({
        stdout: JSON.stringify({
          Names: "godseye-gateway",
          Ports: "0.0.0.0:18789->18789/tcp",
        }),
        stderr: "",
      }),
    );

    const findings = await checkDockerExposure();
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("critical");
    expect(findings[0].title).toContain("godseye-gateway");
    expect(findings[0].remediation).toContain("127.0.0.1:18789:18789");
  });

  it("returns empty when port bound to localhost", async () => {
    mockExec.mockImplementation((_cmd: string, _opts: unknown) =>
      Promise.resolve({
        stdout: JSON.stringify({
          Names: "godseye-gateway",
          Ports: "127.0.0.1:18789->18789/tcp",
        }),
        stderr: "",
      }),
    );

    const findings = await checkDockerExposure();
    expect(findings).toHaveLength(0);
  });

  it("returns empty when docker is not available", async () => {
    mockExec.mockImplementation(() => Promise.reject(new Error("docker not found")));

    const findings = await checkDockerExposure();
    expect(findings).toHaveLength(0);
  });

  it("handles malformed docker output", async () => {
    mockExec.mockImplementation((_cmd: string, _opts: unknown) =>
      Promise.resolve({
        stdout: "not-json\n",
        stderr: "",
      }),
    );

    const findings = await checkDockerExposure();
    expect(findings).toHaveLength(0);
  });
});

describe("auditNetworkExposure", () => {
  it("aggregates findings from all checks", async () => {
    // Mock exec to return findings for both interface and docker checks.
    let callCount = 0;
    mockExec.mockImplementation((_cmd: string, _opts: unknown) => {
      callCount++;
      // First two calls are for checkListeningInterfaces (ss then netstat fallback).
      // Third call is for checkDockerExposure.
      if (callCount === 1) {
        return Promise.resolve({
          stdout:
            "State  Recv-Q Send-Q  Local Address:Port  Peer Address:Port\n" +
            "LISTEN 0      128     0.0.0.0:18789       0.0.0.0:*\n",
          stderr: "",
        });
      }
      return Promise.resolve({
        stdout: JSON.stringify({
          Names: "test-container",
          Ports: "0.0.0.0:18789->18789/tcp",
        }),
        stderr: "",
      });
    });

    const findings = await auditNetworkExposure({
      bind: "lan",
      port: 18789,
    });

    // bind check (critical) + interface check (warn) + docker check (critical)
    expect(findings.length).toBeGreaterThanOrEqual(2);
    expect(findings.some((f) => f.severity === "critical")).toBe(true);
  });

  it("returns empty for secure config", async () => {
    mockExec.mockImplementation((_cmd: string, _opts: unknown) =>
      Promise.resolve({ stdout: "", stderr: "" }),
    );

    const findings = await auditNetworkExposure({
      bind: "loopback",
      port: 18789,
      tls: { enabled: true },
    });

    expect(findings).toHaveLength(0);
  });
});
