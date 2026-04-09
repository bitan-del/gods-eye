import type { PluginRuntime } from "godseye/plugin-sdk/core";
import { createPluginRuntimeStore } from "godseye/plugin-sdk/runtime-store";

const {
  setRuntime: setSignalRuntime,
  clearRuntime: clearSignalRuntime,
  getRuntime: getSignalRuntime,
} = createPluginRuntimeStore<PluginRuntime>("Signal runtime not initialized");
export { clearSignalRuntime, getSignalRuntime, setSignalRuntime };
