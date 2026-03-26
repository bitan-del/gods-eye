// Narrow plugin-sdk surface for the bundled diffs plugin.
// Keep this list additive and scoped to symbols used under extensions/diffs.

export { definePluginEntry } from "./plugin-entry.js";
export type { GodsEyeConfig } from "../config/config.js";
export { resolvePreferredGodsEyeTmpDir } from "../infra/tmp-godseye-dir.js";
export type {
  AnyAgentTool,
  GodsEyePluginApi,
  GodsEyePluginConfigSchema,
  GodsEyePluginToolContext,
  PluginLogger,
} from "../plugins/types.js";
