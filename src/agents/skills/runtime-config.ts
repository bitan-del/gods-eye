import { getRuntimeConfigSnapshot, type GodsEyeConfig } from "../../config/config.js";

export function resolveSkillRuntimeConfig(config?: GodsEyeConfig): GodsEyeConfig | undefined {
  return getRuntimeConfigSnapshot() ?? config;
}
