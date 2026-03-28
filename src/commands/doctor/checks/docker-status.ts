import { execFile } from "node:child_process";
import type { CheckResult, DoctorCheck } from "../check-framework.js";

/**
 * Run a shell command and resolve with { ok, stdout, stderr }.
 * Never rejects; captures failures as ok=false.
 */
function exec(
  cmd: string,
  args: string[],
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 10_000 }, (error, stdout, stderr) => {
      resolve({ ok: !error, stdout: stdout ?? "", stderr: stderr ?? "" });
    });
  });
}

export class DockerStatusCheck implements DoctorCheck {
  name = "Docker Daemon";
  category = "runtime" as const;

  async check(): Promise<CheckResult> {
    const result = await exec("docker", ["info", "--format", "{{.ServerVersion}}"]);

    if (!result.ok) {
      // Distinguish "docker not installed" from "daemon not running".
      const notFound = result.stderr.includes("not found") || result.stderr.includes("ENOENT");
      if (notFound) {
        return {
          status: "warn",
          message: "Docker is not installed",
          detail: "Docker is optional but required for containerized sandboxing.",
          fixHint: "Install Docker from https://docs.docker.com/get-docker/",
        };
      }

      return {
        status: "warn",
        message: "Docker daemon is not running",
        detail: result.stderr.trim().split("\n")[0] || "Could not connect to Docker daemon",
        fixHint: "Start Docker Desktop or run `sudo systemctl start docker`",
      };
    }

    const version = result.stdout.trim();
    return {
      status: "pass",
      message: `Docker ${version}`,
      detail: "Docker daemon is reachable",
    };
  }
}
