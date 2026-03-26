import type { PluginRuntime } from "godseye/plugin-sdk/core";
import { createPluginRuntimeStore } from "godseye/plugin-sdk/runtime-store";

const { setRuntime: setDiscordRuntime, getRuntime: getDiscordRuntime } =
  createPluginRuntimeStore<PluginRuntime>("Discord runtime not initialized");
export { getDiscordRuntime, setDiscordRuntime };
