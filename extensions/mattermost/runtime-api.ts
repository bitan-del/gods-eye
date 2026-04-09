// Private runtime barrel for the bundled Mattermost extension.
// Keep this barrel thin and generic-only.

export type {
  BaseProbeResult,
  ChannelAccountSnapshot,
  ChannelDirectoryEntry,
  ChannelGroupContext,
  ChannelMessageActionName,
  ChannelPlugin,
  ChatType,
  HistoryEntry,
  OpenClawConfig,
  OpenClawPluginApi,
  PluginRuntime,
} from "godseye/plugin-sdk/core";
export type { RuntimeEnv } from "godseye/plugin-sdk/runtime";
export type { ReplyPayload } from "godseye/plugin-sdk/reply-runtime";
export type { ModelsProviderData } from "godseye/plugin-sdk/command-auth";
export type {
  BlockStreamingCoalesceConfig,
  DmPolicy,
  GroupPolicy,
} from "godseye/plugin-sdk/config-runtime";
export {
  DEFAULT_ACCOUNT_ID,
  buildChannelConfigSchema,
  createDedupeCache,
  parseStrictPositiveInteger,
  resolveClientIp,
  isTrustedProxyAddress,
} from "godseye/plugin-sdk/core";
export { buildComputedAccountStatusSnapshot } from "godseye/plugin-sdk/channel-status";
export { createAccountStatusSink } from "godseye/plugin-sdk/channel-lifecycle";
export { buildAgentMediaPayload } from "godseye/plugin-sdk/agent-media-payload";
export {
  buildModelsProviderData,
  listSkillCommandsForAgents,
  resolveControlCommandGate,
  resolveStoredModelOverride,
} from "godseye/plugin-sdk/command-auth";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  isDangerousNameMatchingEnabled,
  loadSessionStore,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  resolveStorePath,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "godseye/plugin-sdk/config-runtime";
export { formatInboundFromLabel } from "godseye/plugin-sdk/channel-inbound";
export { logInboundDrop } from "godseye/plugin-sdk/channel-inbound";
export { createChannelPairingController } from "godseye/plugin-sdk/channel-pairing";
export {
  DM_GROUP_ACCESS_REASON,
  readStoreAllowFromForDmPolicy,
  resolveDmGroupAccessWithLists,
  resolveEffectiveAllowFromLists,
} from "godseye/plugin-sdk/channel-policy";
export { evaluateSenderGroupAccessForPolicy } from "godseye/plugin-sdk/group-access";
export { createChannelReplyPipeline } from "godseye/plugin-sdk/channel-reply-pipeline";
export { logTypingFailure } from "godseye/plugin-sdk/channel-feedback";
export { loadOutboundMediaFromUrl } from "godseye/plugin-sdk/outbound-media";
export { rawDataToString } from "godseye/plugin-sdk/browser-node-runtime";
export { chunkTextForOutbound } from "godseye/plugin-sdk/text-chunking";
export {
  DEFAULT_GROUP_HISTORY_LIMIT,
  buildPendingHistoryContextFromMap,
  clearHistoryEntriesIfEnabled,
  recordPendingHistoryEntryIfEnabled,
} from "godseye/plugin-sdk/reply-history";
export { normalizeAccountId, resolveThreadSessionKeys } from "godseye/plugin-sdk/routing";
export { resolveAllowlistMatchSimple } from "godseye/plugin-sdk/allow-from";
export { registerPluginHttpRoute } from "godseye/plugin-sdk/webhook-targets";
export {
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
} from "godseye/plugin-sdk/webhook-ingress";
export {
  applyAccountNameToChannelSection,
  applySetupAccountConfigPatch,
  migrateBaseNameToDefaultAccount,
} from "godseye/plugin-sdk/setup";
export {
  getAgentScopedMediaLocalRoots,
  resolveChannelMediaMaxBytes,
} from "godseye/plugin-sdk/media-runtime";
export { normalizeProviderId } from "godseye/plugin-sdk/provider-model-shared";
export { setMattermostRuntime } from "./src/runtime.js";
