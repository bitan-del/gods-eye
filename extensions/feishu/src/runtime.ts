import type { PluginRuntime } from "godseye/plugin-sdk/core";
import { createPluginRuntimeStore } from "godseye/plugin-sdk/runtime-store";

const { setRuntime: setFeishuRuntime, getRuntime: getFeishuRuntime } =
  createPluginRuntimeStore<PluginRuntime>("Feishu runtime not initialized");
export { getFeishuRuntime, setFeishuRuntime };
