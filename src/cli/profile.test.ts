import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatCliCommand } from "./command-format.js";
import { applyCliProfileEnv, parseCliProfileArgs } from "./profile.js";

describe("parseCliProfileArgs", () => {
  it("leaves gateway --dev for subcommands", () => {
    const res = parseCliProfileArgs([
      "node",
      "godseye",
      "gateway",
      "--dev",
      "--allow-unconfigured",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual(["node", "godseye", "gateway", "--dev", "--allow-unconfigured"]);
  });

  it("leaves gateway --dev for subcommands after leading root options", () => {
    const res = parseCliProfileArgs([
      "node",
      "godseye",
      "--no-color",
      "gateway",
      "--dev",
      "--allow-unconfigured",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual([
      "node",
      "godseye",
      "--no-color",
      "gateway",
      "--dev",
      "--allow-unconfigured",
    ]);
  });

  it("still accepts global --dev before subcommand", () => {
    const res = parseCliProfileArgs(["node", "godseye", "--dev", "gateway"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("dev");
    expect(res.argv).toEqual(["node", "godseye", "gateway"]);
  });

  it("parses --profile value and strips it", () => {
    const res = parseCliProfileArgs(["node", "godseye", "--profile", "work", "status"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("work");
    expect(res.argv).toEqual(["node", "godseye", "status"]);
  });

  it("parses interleaved --profile after the command token", () => {
    const res = parseCliProfileArgs(["node", "godseye", "status", "--profile", "work", "--deep"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("work");
    expect(res.argv).toEqual(["node", "godseye", "status", "--deep"]);
  });

  it("parses interleaved --dev after the command token", () => {
    const res = parseCliProfileArgs(["node", "godseye", "status", "--dev"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("dev");
    expect(res.argv).toEqual(["node", "godseye", "status"]);
  });

  it("rejects missing profile value", () => {
    const res = parseCliProfileArgs(["node", "godseye", "--profile"]);
    expect(res.ok).toBe(false);
  });

  it.each([
    ["--dev first", ["node", "godseye", "--dev", "--profile", "work", "status"]],
    ["--profile first", ["node", "godseye", "--profile", "work", "--dev", "status"]],
    ["interleaved after command", ["node", "godseye", "status", "--profile", "work", "--dev"]],
  ])("rejects combining --dev with --profile (%s)", (_name, argv) => {
    const res = parseCliProfileArgs(argv);
    expect(res.ok).toBe(false);
  });
});

describe("applyCliProfileEnv", () => {
  it("fills env defaults for dev profile", () => {
    const env: Record<string, string | undefined> = {};
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    const expectedStateDir = path.join(path.resolve("/home/peter"), ".godseye-dev");
    expect(env.GODSEYE_PROFILE).toBe("dev");
    expect(env.GODSEYE_STATE_DIR).toBe(expectedStateDir);
    expect(env.GODSEYE_CONFIG_PATH).toBe(path.join(expectedStateDir, "godseye.json"));
    expect(env.GODSEYE_GATEWAY_PORT).toBe("19001");
  });

  it("does not override explicit env values", () => {
    const env: Record<string, string | undefined> = {
      GODSEYE_STATE_DIR: "/custom",
      GODSEYE_GATEWAY_PORT: "19099",
    };
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    expect(env.GODSEYE_STATE_DIR).toBe("/custom");
    expect(env.GODSEYE_GATEWAY_PORT).toBe("19099");
    expect(env.GODSEYE_CONFIG_PATH).toBe(path.join("/custom", "godseye.json"));
  });

  it("uses GODSEYE_HOME when deriving profile state dir", () => {
    const env: Record<string, string | undefined> = {
      GODSEYE_HOME: "/srv/godseye-home",
      HOME: "/home/other",
    };
    applyCliProfileEnv({
      profile: "work",
      env,
      homedir: () => "/home/fallback",
    });

    const resolvedHome = path.resolve("/srv/godseye-home");
    expect(env.GODSEYE_STATE_DIR).toBe(path.join(resolvedHome, ".godseye-work"));
    expect(env.GODSEYE_CONFIG_PATH).toBe(
      path.join(resolvedHome, ".godseye-work", "godseye.json"),
    );
  });
});

describe("formatCliCommand", () => {
  it.each([
    {
      name: "no profile is set",
      cmd: "godseye doctor --fix",
      env: {},
      expected: "godseye doctor --fix",
    },
    {
      name: "profile is default",
      cmd: "godseye doctor --fix",
      env: { GODSEYE_PROFILE: "default" },
      expected: "godseye doctor --fix",
    },
    {
      name: "profile is Default (case-insensitive)",
      cmd: "godseye doctor --fix",
      env: { GODSEYE_PROFILE: "Default" },
      expected: "godseye doctor --fix",
    },
    {
      name: "profile is invalid",
      cmd: "godseye doctor --fix",
      env: { GODSEYE_PROFILE: "bad profile" },
      expected: "godseye doctor --fix",
    },
    {
      name: "--profile is already present",
      cmd: "godseye --profile work doctor --fix",
      env: { GODSEYE_PROFILE: "work" },
      expected: "godseye --profile work doctor --fix",
    },
    {
      name: "--dev is already present",
      cmd: "godseye --dev doctor",
      env: { GODSEYE_PROFILE: "dev" },
      expected: "godseye --dev doctor",
    },
  ])("returns command unchanged when $name", ({ cmd, env, expected }) => {
    expect(formatCliCommand(cmd, env)).toBe(expected);
  });

  it("inserts --profile flag when profile is set", () => {
    expect(formatCliCommand("godseye doctor --fix", { GODSEYE_PROFILE: "work" })).toBe(
      "godseye --profile work doctor --fix",
    );
  });

  it("trims whitespace from profile", () => {
    expect(formatCliCommand("godseye doctor --fix", { GODSEYE_PROFILE: "  jbgodseye  " })).toBe(
      "godseye --profile jbgodseye doctor --fix",
    );
  });

  it("handles command with no args after godseye", () => {
    expect(formatCliCommand("godseye", { GODSEYE_PROFILE: "test" })).toBe(
      "godseye --profile test",
    );
  });

  it("handles pnpm wrapper", () => {
    expect(formatCliCommand("pnpm godseye doctor", { GODSEYE_PROFILE: "work" })).toBe(
      "pnpm godseye --profile work doctor",
    );
  });

  it("inserts --container when a container hint is set", () => {
    expect(
      formatCliCommand("godseye gateway status --deep", { GODSEYE_CONTAINER_HINT: "demo" }),
    ).toBe("godseye --container demo gateway status --deep");
  });

  it("preserves both --container and --profile hints", () => {
    expect(
      formatCliCommand("godseye doctor", {
        GODSEYE_CONTAINER_HINT: "demo",
        GODSEYE_PROFILE: "work",
      }),
    ).toBe("godseye --container demo doctor");
  });

  it("does not prepend --container for update commands", () => {
    expect(formatCliCommand("godseye update", { GODSEYE_CONTAINER_HINT: "demo" })).toBe(
      "godseye update",
    );
    expect(
      formatCliCommand("pnpm godseye update --channel beta", { GODSEYE_CONTAINER_HINT: "demo" }),
    ).toBe("pnpm godseye update --channel beta");
  });
});
