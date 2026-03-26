import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BUNDLED_RUNTIME_SIDECAR_PATHS } from "../extensions/public-artifacts.js";
import { captureEnv } from "../test-utils/env.js";
import {
  canResolveRegistryVersionForPackageTarget,
  collectInstalledGlobalPackageErrors,
  cleanupGlobalRenameDirs,
  detectGlobalInstallManagerByPresence,
  detectGlobalInstallManagerForRoot,
  globalInstallArgs,
  globalInstallFallbackArgs,
  isExplicitPackageInstallSpec,
  isMainPackageTarget,
  GODSEYE_MAIN_PACKAGE_SPEC,
  resolveGlobalPackageRoot,
  resolveGlobalInstallSpec,
  resolveGlobalRoot,
  type CommandRunner,
} from "./update-global.js";

describe("update global helpers", () => {
  let envSnapshot: ReturnType<typeof captureEnv> | undefined;

  afterEach(() => {
    envSnapshot?.restore();
    envSnapshot = undefined;
  });

  it("prefers explicit package spec overrides", () => {
    envSnapshot = captureEnv(["GODSEYE_UPDATE_PACKAGE_SPEC"]);
    process.env.GODSEYE_UPDATE_PACKAGE_SPEC = "file:/tmp/godseye.tgz";

    expect(resolveGlobalInstallSpec({ packageName: "godseye", tag: "latest" })).toBe(
      "file:/tmp/godseye.tgz",
    );
    expect(
      resolveGlobalInstallSpec({
        packageName: "godseye",
        tag: "beta",
        env: { GODSEYE_UPDATE_PACKAGE_SPEC: "godseye@next" },
      }),
    ).toBe("godseye@next");
  });

  it("resolves global roots and package roots from runner output", async () => {
    const runCommand: CommandRunner = async (argv) => {
      if (argv[0] === "npm") {
        return { stdout: "/tmp/npm-root\n", stderr: "", code: 0 };
      }
      if (argv[0] === "pnpm") {
        return { stdout: "", stderr: "", code: 1 };
      }
      throw new Error(`unexpected command: ${argv.join(" ")}`);
    };

    await expect(resolveGlobalRoot("npm", runCommand, 1000)).resolves.toBe("/tmp/npm-root");
    await expect(resolveGlobalRoot("pnpm", runCommand, 1000)).resolves.toBeNull();
    await expect(resolveGlobalRoot("bun", runCommand, 1000)).resolves.toContain(
      path.join(".bun", "install", "global", "node_modules"),
    );
    await expect(resolveGlobalPackageRoot("npm", runCommand, 1000)).resolves.toBe(
      path.join("/tmp/npm-root", "godseye"),
    );
  });

  it("maps main and explicit install specs for global installs", () => {
    expect(resolveGlobalInstallSpec({ packageName: "godseye", tag: "main" })).toBe(
      GODSEYE_MAIN_PACKAGE_SPEC,
    );
    expect(
      resolveGlobalInstallSpec({
        packageName: "godseye",
        tag: "github:godseye/godseye#feature/my-branch",
      }),
    ).toBe("github:godseye/godseye#feature/my-branch");
    expect(
      resolveGlobalInstallSpec({
        packageName: "godseye",
        tag: "https://example.com/godseye-main.tgz",
      }),
    ).toBe("https://example.com/godseye-main.tgz");
  });

  it("classifies main and raw install specs separately from registry selectors", () => {
    expect(isMainPackageTarget("main")).toBe(true);
    expect(isMainPackageTarget(" MAIN ")).toBe(true);
    expect(isMainPackageTarget("beta")).toBe(false);

    expect(isExplicitPackageInstallSpec("github:godseye/godseye#main")).toBe(true);
    expect(isExplicitPackageInstallSpec("https://example.com/godseye-main.tgz")).toBe(true);
    expect(isExplicitPackageInstallSpec("file:/tmp/godseye-main.tgz")).toBe(true);
    expect(isExplicitPackageInstallSpec("beta")).toBe(false);

    expect(canResolveRegistryVersionForPackageTarget("latest")).toBe(true);
    expect(canResolveRegistryVersionForPackageTarget("2026.3.22")).toBe(true);
    expect(canResolveRegistryVersionForPackageTarget("main")).toBe(false);
    expect(canResolveRegistryVersionForPackageTarget("github:godseye/godseye#main")).toBe(false);
  });

  it("detects install managers from resolved roots and on-disk presence", async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), "godseye-update-global-"));
    const npmRoot = path.join(base, "npm-root");
    const pnpmRoot = path.join(base, "pnpm-root");
    const bunRoot = path.join(base, ".bun", "install", "global", "node_modules");
    const pkgRoot = path.join(pnpmRoot, "godseye");
    await fs.mkdir(pkgRoot, { recursive: true });
    await fs.mkdir(path.join(npmRoot, "godseye"), { recursive: true });
    await fs.mkdir(path.join(bunRoot, "godseye"), { recursive: true });

    envSnapshot = captureEnv(["BUN_INSTALL"]);
    process.env.BUN_INSTALL = path.join(base, ".bun");

    const runCommand: CommandRunner = async (argv) => {
      if (argv[0] === "npm") {
        return { stdout: `${npmRoot}\n`, stderr: "", code: 0 };
      }
      if (argv[0] === "pnpm") {
        return { stdout: `${pnpmRoot}\n`, stderr: "", code: 0 };
      }
      throw new Error(`unexpected command: ${argv.join(" ")}`);
    };

    await expect(detectGlobalInstallManagerForRoot(runCommand, pkgRoot, 1000)).resolves.toBe(
      "pnpm",
    );
    await expect(detectGlobalInstallManagerByPresence(runCommand, 1000)).resolves.toBe("npm");

    await fs.rm(path.join(npmRoot, "godseye"), { recursive: true, force: true });
    await fs.rm(path.join(pnpmRoot, "godseye"), { recursive: true, force: true });
    await expect(detectGlobalInstallManagerByPresence(runCommand, 1000)).resolves.toBe("bun");
  });

  it("builds install argv and npm fallback argv", () => {
    expect(globalInstallArgs("npm", "godseye@latest")).toEqual([
      "npm",
      "i",
      "-g",
      "godseye@latest",
      "--no-fund",
      "--no-audit",
      "--loglevel=error",
    ]);
    expect(globalInstallArgs("pnpm", "godseye@latest")).toEqual([
      "pnpm",
      "add",
      "-g",
      "godseye@latest",
    ]);
    expect(globalInstallArgs("bun", "godseye@latest")).toEqual([
      "bun",
      "add",
      "-g",
      "godseye@latest",
    ]);

    expect(globalInstallFallbackArgs("npm", "godseye@latest")).toEqual([
      "npm",
      "i",
      "-g",
      "godseye@latest",
      "--omit=optional",
      "--no-fund",
      "--no-audit",
      "--loglevel=error",
    ]);
    expect(globalInstallFallbackArgs("pnpm", "godseye@latest")).toBeNull();
  });

  it("cleans only renamed package directories", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "godseye-update-cleanup-"));
    await fs.mkdir(path.join(root, ".godseye-123"), { recursive: true });
    await fs.mkdir(path.join(root, ".godseye-456"), { recursive: true });
    await fs.writeFile(path.join(root, ".godseye-file"), "nope", "utf8");
    await fs.mkdir(path.join(root, "godseye"), { recursive: true });

    await expect(
      cleanupGlobalRenameDirs({
        globalRoot: root,
        packageName: "godseye",
      }),
    ).resolves.toEqual({
      removed: [".godseye-123", ".godseye-456"],
    });
    await expect(fs.stat(path.join(root, "godseye"))).resolves.toBeDefined();
    await expect(fs.stat(path.join(root, ".godseye-file"))).resolves.toBeDefined();
  });

  it("checks bundled runtime sidecars, including Matrix helper-api", async () => {
    const packageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "godseye-update-global-pkg-"));
    await fs.writeFile(
      path.join(packageRoot, "package.json"),
      JSON.stringify({ name: "godseye", version: "1.0.0" }),
      "utf-8",
    );
    for (const relativePath of BUNDLED_RUNTIME_SIDECAR_PATHS) {
      const absolutePath = path.join(packageRoot, relativePath);
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, "export {};\n", "utf-8");
    }

    await expect(collectInstalledGlobalPackageErrors({ packageRoot })).resolves.toEqual([]);

    await fs.rm(path.join(packageRoot, "dist/extensions/matrix/helper-api.js"));
    await expect(collectInstalledGlobalPackageErrors({ packageRoot })).resolves.toContain(
      "missing bundled runtime sidecar dist/extensions/matrix/helper-api.js",
    );
  });
});
