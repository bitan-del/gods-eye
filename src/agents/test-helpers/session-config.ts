import type { GodsEyeConfig } from "../../config/config.js";

export function createPerSenderSessionConfig(
  overrides: Partial<NonNullable<GodsEyeConfig["session"]>> = {},
): NonNullable<GodsEyeConfig["session"]> {
  return {
    mainKey: "main",
    scope: "per-sender",
    ...overrides,
  };
}
