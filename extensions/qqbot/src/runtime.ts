import type { PluginRuntime } from "godseye/plugin-sdk/core";
import { createPluginRuntimeStore } from "godseye/plugin-sdk/runtime-store";

const { setRuntime: setQQBotRuntime, getRuntime: getQQBotRuntime } =
  createPluginRuntimeStore<PluginRuntime>("QQBot runtime not initialized");
export { getQQBotRuntime, setQQBotRuntime };
