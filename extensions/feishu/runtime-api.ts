// Private runtime barrel for the bundled Feishu extension.
// Keep this barrel thin and generic-only.

export type {
  AllowlistMatch,
  AnyAgentTool,
  BaseProbeResult,
  ChannelGroupContext,
  ChannelMessageActionName,
  ChannelMeta,
  ChannelOutboundAdapter,
  ChannelPlugin,
  HistoryEntry,
  OpenClawConfig,
  OpenClawPluginApi,
  OutboundIdentity,
  PluginRuntime,
  ReplyPayload,
} from "godseye/plugin-sdk/core";
export type { OpenClawConfig as ClawdbotConfig } from "godseye/plugin-sdk/core";
export type { RuntimeEnv } from "godseye/plugin-sdk/runtime";
export type { GroupToolPolicyConfig } from "godseye/plugin-sdk/config-runtime";
export {
  DEFAULT_ACCOUNT_ID,
  buildChannelConfigSchema,
  createActionGate,
  createDedupeCache,
} from "godseye/plugin-sdk/core";
export {
  PAIRING_APPROVED_MESSAGE,
  buildProbeChannelStatusSummary,
  createDefaultChannelRuntimeState,
} from "godseye/plugin-sdk/channel-status";
export { buildAgentMediaPayload } from "godseye/plugin-sdk/agent-media-payload";
export { createChannelPairingController } from "godseye/plugin-sdk/channel-pairing";
export { createReplyPrefixContext } from "godseye/plugin-sdk/channel-reply-pipeline";
export {
  evaluateSupplementalContextVisibility,
  filterSupplementalContextItems,
  resolveChannelContextVisibilityMode,
} from "godseye/plugin-sdk/config-runtime";
export { loadSessionStore, resolveSessionStoreEntry } from "godseye/plugin-sdk/config-runtime";
export { readJsonFileWithFallback } from "godseye/plugin-sdk/json-store";
export { createPersistentDedupe } from "godseye/plugin-sdk/persistent-dedupe";
export { normalizeAgentId } from "godseye/plugin-sdk/routing";
export { chunkTextForOutbound } from "godseye/plugin-sdk/text-chunking";
export {
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
  requestBodyErrorToText,
} from "godseye/plugin-sdk/webhook-ingress";
export { setFeishuRuntime } from "./src/runtime.js";
