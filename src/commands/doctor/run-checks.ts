import chalk from "chalk";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type CheckCategory,
  type CheckResult,
  type DoctorCheck,
} from "./check-framework.js";
import { ConfigValidCheck } from "./checks/config-valid.js";
import { DiskSpaceCheck } from "./checks/disk-space.js";
import { DockerStatusCheck } from "./checks/docker-status.js";
import { GatewayTokenCheck } from "./checks/gateway-token.js";
import { NodeVersionCheck } from "./checks/node-version.js";
import { PortAvailabilityCheck } from "./checks/port-availability.js";

// ── Status icons (Flutter doctor style) ─────────────────────────

const ICONS: Record<CheckResult["status"], string> = {
  pass: chalk.green("\u2713"), // checkmark
  warn: chalk.yellow("!"),
  fail: chalk.red("\u2717"), // cross
};

// ── Registry ────────────────────────────────────────────────────

/** All built-in doctor checks. Add new checks here. */
function allChecks(): DoctorCheck[] {
  return [
    new NodeVersionCheck(),
    new DiskSpaceCheck(),
    new DockerStatusCheck(),
    new PortAvailabilityCheck(),
    new ConfigValidCheck(),
    new GatewayTokenCheck(),
  ];
}

// ── Types ───────────────────────────────────────────────────────

type ResolvedCheck = {
  check: DoctorCheck;
  result: CheckResult;
};

export type RunChecksOptions = {
  verbose?: boolean;
  /** When true, prompt the user before applying fixes. */
  confirm?: (message: string) => Promise<boolean>;
};

// ── Runner ──────────────────────────────────────────────────────

/**
 * Run all doctor checks grouped by category, print Flutter-style output,
 * and optionally offer auto-fix for fixable failures.
 *
 * Returns process exit code: 0 = all pass, 1 = any fail.
 */
export async function runDoctorChecks(opts: RunChecksOptions = {}): Promise<number> {
  const checks = allChecks();

  // Group checks by category.
  const byCategory = new Map<CheckCategory, DoctorCheck[]>();
  for (const c of checks) {
    const list = byCategory.get(c.category) ?? [];
    list.push(c);
    byCategory.set(c.category, list);
  }

  const resolved: ResolvedCheck[] = [];

  // Run each category in display order; checks within a category run in parallel.
  for (const cat of CATEGORY_ORDER) {
    const group = byCategory.get(cat);
    if (!group || group.length === 0) {
      continue;
    }

    process.stderr.write(`\n${chalk.bold(CATEGORY_LABELS[cat])}\n`);

    const results = await Promise.all(
      group.map(async (doctorCheck): Promise<ResolvedCheck> => {
        try {
          const result = await doctorCheck.check();
          return { check: doctorCheck, result };
        } catch (err) {
          return {
            check: doctorCheck,
            result: {
              status: "fail",
              message: `Unexpected error: ${(err as Error).message}`,
            },
          };
        }
      }),
    );

    // Print results for this category.
    for (const { check: dc, result } of results) {
      const icon = ICONS[result.status];
      process.stderr.write(`  ${icon} ${result.message}\n`);

      if (opts.verbose && result.detail) {
        process.stderr.write(chalk.dim(`      ${result.detail}\n`));
      }

      if (result.fixHint && result.status !== "pass") {
        process.stderr.write(chalk.dim(`      ${result.fixHint}\n`));
      }

      resolved.push({ check: dc, result });
    }
  }

  // ── Summary ─────────────────────────────────────────────────

  const passes = resolved.filter((r) => r.result.status === "pass").length;
  const warns = resolved.filter((r) => r.result.status === "warn").length;
  const fails = resolved.filter((r) => r.result.status === "fail").length;

  process.stderr.write("\n");
  process.stderr.write(
    `${chalk.bold("Summary:")} ${chalk.green(`${passes} passed`)}, ${chalk.yellow(`${warns} warnings`)}, ${chalk.red(`${fails} failures`)}\n`,
  );

  // ── Auto-fix pass ───────────────────────────────────────────

  if (opts.confirm) {
    const fixable = resolved.filter(
      (r) => r.result.fixable && r.check.fix && r.result.status === "fail",
    );

    if (fixable.length > 0) {
      process.stderr.write(`\n${fixable.length} issue(s) can be auto-fixed.\n`);

      for (const { check: dc, result } of fixable) {
        const shouldFix = await opts.confirm(
          `Fix "${dc.name}"? (${result.fixHint ?? "auto-fix available"})`,
        );
        if (shouldFix && dc.fix) {
          const ok = await dc.fix();
          if (ok) {
            process.stderr.write(`  ${chalk.green("\u2713")} Fixed: ${dc.name}\n`);
          } else {
            process.stderr.write(`  ${chalk.red("\u2717")} Fix failed: ${dc.name}\n`);
          }
        }
      }
    }
  }

  return fails > 0 ? 1 : 0;
}
