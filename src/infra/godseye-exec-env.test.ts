import { describe, expect, it } from "vitest";
import {
  ensureGodsEyeExecMarkerOnProcess,
  markGodsEyeExecEnv,
  GODSEYE_CLI_ENV_VALUE,
  GODSEYE_CLI_ENV_VAR,
} from "./godseye-exec-env.js";

describe("markGodsEyeExecEnv", () => {
  it("returns a cloned env object with the exec marker set", () => {
    const env = { PATH: "/usr/bin", GODSEYE_CLI: "0" };
    const marked = markGodsEyeExecEnv(env);

    expect(marked).toEqual({
      PATH: "/usr/bin",
      GODSEYE_CLI: GODSEYE_CLI_ENV_VALUE,
    });
    expect(marked).not.toBe(env);
    expect(env.GODSEYE_CLI).toBe("0");
  });
});

describe("ensureGodsEyeExecMarkerOnProcess", () => {
  it("mutates and returns the provided process env", () => {
    const env: NodeJS.ProcessEnv = { PATH: "/usr/bin" };

    expect(ensureGodsEyeExecMarkerOnProcess(env)).toBe(env);
    expect(env[GODSEYE_CLI_ENV_VAR]).toBe(GODSEYE_CLI_ENV_VALUE);
  });

  it("defaults to mutating process.env when no env object is provided", () => {
    const previous = process.env[GODSEYE_CLI_ENV_VAR];
    delete process.env[GODSEYE_CLI_ENV_VAR];

    try {
      expect(ensureGodsEyeExecMarkerOnProcess()).toBe(process.env);
      expect(process.env[GODSEYE_CLI_ENV_VAR]).toBe(GODSEYE_CLI_ENV_VALUE);
    } finally {
      if (previous === undefined) {
        delete process.env[GODSEYE_CLI_ENV_VAR];
      } else {
        process.env[GODSEYE_CLI_ENV_VAR] = previous;
      }
    }
  });
});
