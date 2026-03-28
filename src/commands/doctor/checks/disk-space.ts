import { execFile } from "node:child_process";
import os from "node:os";
import type { CheckResult, DoctorCheck } from "../check-framework.js";

const ONE_GB = 1024 * 1024 * 1024;
const WARN_THRESHOLD = ONE_GB; // 1 GB
const FAIL_THRESHOLD = 100 * 1024 * 1024; // 100 MB

/** Format bytes as a human-readable string. */
function formatBytes(bytes: number): string {
  if (bytes >= ONE_GB) {
    return `${(bytes / ONE_GB).toFixed(1)} GB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

/**
 * Get available disk space in bytes for the home directory.
 * Uses `df` on Unix; falls back to a generous estimate on unsupported platforms.
 */
function getAvailableSpace(): Promise<number> {
  return new Promise((resolve) => {
    const homedir = os.homedir();
    execFile("df", ["-k", homedir], { timeout: 5_000 }, (error, stdout) => {
      if (error || !stdout) {
        // Cannot determine; assume plenty so we don't block on exotic platforms.
        resolve(Number.MAX_SAFE_INTEGER);
        return;
      }
      // df -k output: Filesystem 1K-blocks Used Available ...
      // The available column is typically index 3 in the second line.
      const lines = stdout.trim().split("\n");
      if (lines.length < 2) {
        resolve(Number.MAX_SAFE_INTEGER);
        return;
      }
      const cols = lines[1].split(/\s+/);
      const availKb = Number.parseInt(cols[3], 10);
      resolve(Number.isNaN(availKb) ? Number.MAX_SAFE_INTEGER : availKb * 1024);
    });
  });
}

export class DiskSpaceCheck implements DoctorCheck {
  name = "Disk Space";
  category = "runtime" as const;

  async check(): Promise<CheckResult> {
    const available = await getAvailableSpace();

    if (available === Number.MAX_SAFE_INTEGER) {
      return {
        status: "pass",
        message: "Disk space check skipped (unable to determine)",
        detail: "Could not query available disk space on this platform",
      };
    }

    const formatted = formatBytes(available);

    if (available < FAIL_THRESHOLD) {
      return {
        status: "fail",
        message: `Critically low disk space: ${formatted} available`,
        detail: `Less than ${formatBytes(FAIL_THRESHOLD)} remaining. Gods Eye may not function correctly.`,
        fixHint: "Free up disk space before continuing",
      };
    }

    if (available < WARN_THRESHOLD) {
      return {
        status: "warn",
        message: `Low disk space: ${formatted} available`,
        detail: `Less than ${formatBytes(WARN_THRESHOLD)} remaining.`,
        fixHint: "Consider freeing up disk space",
      };
    }

    return {
      status: "pass",
      message: `Disk space: ${formatted} available`,
    };
  }
}
