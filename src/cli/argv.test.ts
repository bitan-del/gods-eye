import { describe, expect, it } from "vitest";
import {
  buildParseArgv,
  getFlagValue,
  getCommandPath,
  getCommandPositionalsWithRootOptions,
  getCommandPathWithRootOptions,
  getPrimaryCommand,
  getPositiveIntFlagValue,
  getVerboseFlag,
  hasHelpOrVersion,
  hasFlag,
  isRootHelpInvocation,
  isRootVersionInvocation,
  shouldMigrateState,
  shouldMigrateStateFromPath,
} from "./argv.js";

describe("argv helpers", () => {
  it.each([
    {
      name: "help flag",
      argv: ["node", "godseye", "--help"],
      expected: true,
    },
    {
      name: "version flag",
      argv: ["node", "godseye", "-V"],
      expected: true,
    },
    {
      name: "normal command",
      argv: ["node", "godseye", "status"],
      expected: false,
    },
    {
      name: "root -v alias",
      argv: ["node", "godseye", "-v"],
      expected: true,
    },
    {
      name: "root -v alias with profile",
      argv: ["node", "godseye", "--profile", "work", "-v"],
      expected: true,
    },
    {
      name: "root -v alias with log-level",
      argv: ["node", "godseye", "--log-level", "debug", "-v"],
      expected: true,
    },
    {
      name: "subcommand -v should not be treated as version",
      argv: ["node", "godseye", "acp", "-v"],
      expected: false,
    },
    {
      name: "root -v alias with equals profile",
      argv: ["node", "godseye", "--profile=work", "-v"],
      expected: true,
    },
    {
      name: "subcommand path after global root flags should not be treated as version",
      argv: ["node", "godseye", "--dev", "skills", "list", "-v"],
      expected: false,
    },
  ])("detects help/version flags: $name", ({ argv, expected }) => {
    expect(hasHelpOrVersion(argv)).toBe(expected);
  });

  it.each([
    {
      name: "root --version",
      argv: ["node", "godseye", "--version"],
      expected: true,
    },
    {
      name: "root -V",
      argv: ["node", "godseye", "-V"],
      expected: true,
    },
    {
      name: "root -v alias with profile",
      argv: ["node", "godseye", "--profile", "work", "-v"],
      expected: true,
    },
    {
      name: "subcommand version flag",
      argv: ["node", "godseye", "status", "--version"],
      expected: false,
    },
    {
      name: "unknown root flag with version",
      argv: ["node", "godseye", "--unknown", "--version"],
      expected: false,
    },
  ])("detects root-only version invocations: $name", ({ argv, expected }) => {
    expect(isRootVersionInvocation(argv)).toBe(expected);
  });

  it.each([
    {
      name: "root --help",
      argv: ["node", "godseye", "--help"],
      expected: true,
    },
    {
      name: "root -h",
      argv: ["node", "godseye", "-h"],
      expected: true,
    },
    {
      name: "root --help with profile",
      argv: ["node", "godseye", "--profile", "work", "--help"],
      expected: true,
    },
    {
      name: "subcommand --help",
      argv: ["node", "godseye", "status", "--help"],
      expected: false,
    },
    {
      name: "help before subcommand token",
      argv: ["node", "godseye", "--help", "status"],
      expected: false,
    },
    {
      name: "help after -- terminator",
      argv: ["node", "godseye", "nodes", "run", "--", "git", "--help"],
      expected: false,
    },
    {
      name: "unknown root flag before help",
      argv: ["node", "godseye", "--unknown", "--help"],
      expected: false,
    },
    {
      name: "unknown root flag after help",
      argv: ["node", "godseye", "--help", "--unknown"],
      expected: false,
    },
  ])("detects root-only help invocations: $name", ({ argv, expected }) => {
    expect(isRootHelpInvocation(argv)).toBe(expected);
  });

  it.each([
    {
      name: "single command with trailing flag",
      argv: ["node", "godseye", "status", "--json"],
      expected: ["status"],
    },
    {
      name: "two-part command",
      argv: ["node", "godseye", "agents", "list"],
      expected: ["agents", "list"],
    },
    {
      name: "terminator cuts parsing",
      argv: ["node", "godseye", "status", "--", "ignored"],
      expected: ["status"],
    },
  ])("extracts command path: $name", ({ argv, expected }) => {
    expect(getCommandPath(argv, 2)).toEqual(expected);
  });

  it("extracts command path while skipping known root option values", () => {
    expect(
      getCommandPathWithRootOptions(
        [
          "node",
          "godseye",
          "--profile",
          "work",
          "--container",
          "demo",
          "--no-color",
          "config",
          "validate",
        ],
        2,
      ),
    ).toEqual(["config", "validate"]);
  });

  it("extracts routed config get positionals with interleaved root options", () => {
    expect(
      getCommandPositionalsWithRootOptions(
        ["node", "godseye", "config", "get", "--log-level", "debug", "update.channel", "--json"],
        {
          commandPath: ["config", "get"],
          booleanFlags: ["--json"],
        },
      ),
    ).toEqual(["update.channel"]);
  });

  it("extracts routed config unset positionals with interleaved root options", () => {
    expect(
      getCommandPositionalsWithRootOptions(
        ["node", "godseye", "config", "unset", "--profile", "work", "update.channel"],
        {
          commandPath: ["config", "unset"],
        },
      ),
    ).toEqual(["update.channel"]);
  });

  it("returns null when routed command sees unknown options", () => {
    expect(
      getCommandPositionalsWithRootOptions(
        ["node", "godseye", "config", "get", "--mystery", "value", "update.channel"],
        {
          commandPath: ["config", "get"],
          booleanFlags: ["--json"],
        },
      ),
    ).toBeNull();
  });

  it.each([
    {
      name: "returns first command token",
      argv: ["node", "godseye", "agents", "list"],
      expected: "agents",
    },
    {
      name: "returns null when no command exists",
      argv: ["node", "godseye"],
      expected: null,
    },
    {
      name: "skips known root option values",
      argv: ["node", "godseye", "--log-level", "debug", "status"],
      expected: "status",
    },
  ])("returns primary command: $name", ({ argv, expected }) => {
    expect(getPrimaryCommand(argv)).toBe(expected);
  });

  it.each([
    {
      name: "detects flag before terminator",
      argv: ["node", "godseye", "status", "--json"],
      flag: "--json",
      expected: true,
    },
    {
      name: "ignores flag after terminator",
      argv: ["node", "godseye", "--", "--json"],
      flag: "--json",
      expected: false,
    },
  ])("parses boolean flags: $name", ({ argv, flag, expected }) => {
    expect(hasFlag(argv, flag)).toBe(expected);
  });

  it.each([
    {
      name: "value in next token",
      argv: ["node", "godseye", "status", "--timeout", "5000"],
      expected: "5000",
    },
    {
      name: "value in equals form",
      argv: ["node", "godseye", "status", "--timeout=2500"],
      expected: "2500",
    },
    {
      name: "missing value",
      argv: ["node", "godseye", "status", "--timeout"],
      expected: null,
    },
    {
      name: "next token is another flag",
      argv: ["node", "godseye", "status", "--timeout", "--json"],
      expected: null,
    },
    {
      name: "flag appears after terminator",
      argv: ["node", "godseye", "--", "--timeout=99"],
      expected: undefined,
    },
  ])("extracts flag values: $name", ({ argv, expected }) => {
    expect(getFlagValue(argv, "--timeout")).toBe(expected);
  });

  it("parses verbose flags", () => {
    expect(getVerboseFlag(["node", "godseye", "status", "--verbose"])).toBe(true);
    expect(getVerboseFlag(["node", "godseye", "status", "--debug"])).toBe(false);
    expect(getVerboseFlag(["node", "godseye", "status", "--debug"], { includeDebug: true })).toBe(
      true,
    );
  });

  it.each([
    {
      name: "missing flag",
      argv: ["node", "godseye", "status"],
      expected: undefined,
    },
    {
      name: "missing value",
      argv: ["node", "godseye", "status", "--timeout"],
      expected: null,
    },
    {
      name: "valid positive integer",
      argv: ["node", "godseye", "status", "--timeout", "5000"],
      expected: 5000,
    },
    {
      name: "invalid integer",
      argv: ["node", "godseye", "status", "--timeout", "nope"],
      expected: undefined,
    },
  ])("parses positive integer flag values: $name", ({ argv, expected }) => {
    expect(getPositiveIntFlagValue(argv, "--timeout")).toBe(expected);
  });

  it("builds parse argv from raw args", () => {
    const cases = [
      {
        rawArgs: ["node", "godseye", "status"],
        expected: ["node", "godseye", "status"],
      },
      {
        rawArgs: ["node-22", "godseye", "status"],
        expected: ["node-22", "godseye", "status"],
      },
      {
        rawArgs: ["node-22.2.0.exe", "godseye", "status"],
        expected: ["node-22.2.0.exe", "godseye", "status"],
      },
      {
        rawArgs: ["node-22.2", "godseye", "status"],
        expected: ["node-22.2", "godseye", "status"],
      },
      {
        rawArgs: ["node-22.2.exe", "godseye", "status"],
        expected: ["node-22.2.exe", "godseye", "status"],
      },
      {
        rawArgs: ["/usr/bin/node-22.2.0", "godseye", "status"],
        expected: ["/usr/bin/node-22.2.0", "godseye", "status"],
      },
      {
        rawArgs: ["node24", "godseye", "status"],
        expected: ["node24", "godseye", "status"],
      },
      {
        rawArgs: ["/usr/bin/node24", "godseye", "status"],
        expected: ["/usr/bin/node24", "godseye", "status"],
      },
      {
        rawArgs: ["node24.exe", "godseye", "status"],
        expected: ["node24.exe", "godseye", "status"],
      },
      {
        rawArgs: ["nodejs", "godseye", "status"],
        expected: ["nodejs", "godseye", "status"],
      },
      {
        rawArgs: ["node-dev", "godseye", "status"],
        expected: ["node", "godseye", "node-dev", "godseye", "status"],
      },
      {
        rawArgs: ["godseye", "status"],
        expected: ["node", "godseye", "status"],
      },
      {
        rawArgs: ["bun", "src/entry.ts", "status"],
        expected: ["bun", "src/entry.ts", "status"],
      },
    ] as const;

    for (const testCase of cases) {
      const parsed = buildParseArgv({
        programName: "godseye",
        rawArgs: [...testCase.rawArgs],
      });
      expect(parsed).toEqual([...testCase.expected]);
    }
  });

  it("builds parse argv from fallback args", () => {
    const fallbackArgv = buildParseArgv({
      programName: "godseye",
      fallbackArgv: ["status"],
    });
    expect(fallbackArgv).toEqual(["node", "godseye", "status"]);
  });

  it("decides when to migrate state", () => {
    const nonMutatingArgv = [
      ["node", "godseye", "status"],
      ["node", "godseye", "health"],
      ["node", "godseye", "sessions"],
      ["node", "godseye", "config", "get", "update"],
      ["node", "godseye", "config", "unset", "update"],
      ["node", "godseye", "models", "list"],
      ["node", "godseye", "models", "status"],
      ["node", "godseye", "memory", "status"],
      ["node", "godseye", "update", "status", "--json"],
      ["node", "godseye", "agent", "--message", "hi"],
    ] as const;
    const mutatingArgv = [
      ["node", "godseye", "agents", "list"],
      ["node", "godseye", "message", "send"],
    ] as const;

    for (const argv of nonMutatingArgv) {
      expect(shouldMigrateState([...argv])).toBe(false);
    }
    for (const argv of mutatingArgv) {
      expect(shouldMigrateState([...argv])).toBe(true);
    }
  });

  it.each([
    { path: ["status"], expected: false },
    { path: ["update", "status"], expected: false },
    { path: ["config", "get"], expected: false },
    { path: ["models", "status"], expected: false },
    { path: ["agents", "list"], expected: true },
  ])("reuses command path for migrate state decisions: $path", ({ path, expected }) => {
    expect(shouldMigrateStateFromPath(path)).toBe(expected);
  });
});
