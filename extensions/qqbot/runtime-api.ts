export type { ChannelPlugin, OpenClawPluginApi, PluginRuntime } from "godseye/plugin-sdk/core";
export type { OpenClawConfig } from "godseye/plugin-sdk/config-runtime";
export type {
  OpenClawPluginService,
  OpenClawPluginServiceContext,
  PluginLogger,
} from "godseye/plugin-sdk/core";
export type { ResolvedQQBotAccount, QQBotAccountConfig } from "./src/types.js";
export { getQQBotRuntime, setQQBotRuntime } from "./src/runtime.js";
