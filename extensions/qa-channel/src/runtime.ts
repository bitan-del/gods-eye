import { createPluginRuntimeStore } from "godseye/plugin-sdk/runtime-store";
import type { PluginRuntime } from "./runtime-api.js";

const { setRuntime: setQaChannelRuntime, getRuntime: getQaChannelRuntime } =
  createPluginRuntimeStore<PluginRuntime>("QA channel runtime not initialized");

export { getQaChannelRuntime, setQaChannelRuntime };
