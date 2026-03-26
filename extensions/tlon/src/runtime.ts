import type { PluginRuntime } from "godseye/plugin-sdk/plugin-runtime";
import { createPluginRuntimeStore } from "godseye/plugin-sdk/runtime-store";

const { setRuntime: setTlonRuntime, getRuntime: getTlonRuntime } =
  createPluginRuntimeStore<PluginRuntime>("Tlon runtime not initialized");
export { getTlonRuntime, setTlonRuntime };
