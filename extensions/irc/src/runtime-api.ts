// Private runtime barrel for the bundled IRC extension.
// Keep this barrel thin and generic-only.

export type { BaseProbeResult } from "godseye/plugin-sdk/channel-contract";
export type { ChannelPlugin } from "godseye/plugin-sdk/channel-core";
export type { OpenClawConfig } from "godseye/plugin-sdk/config-runtime";
export type { PluginRuntime } from "godseye/plugin-sdk/runtime-store";
export type { RuntimeEnv } from "godseye/plugin-sdk/runtime";
export type {
  BlockStreamingCoalesceConfig,
  DmConfig,
  DmPolicy,
  GroupPolicy,
  GroupToolPolicyBySenderConfig,
  GroupToolPolicyConfig,
  MarkdownConfig,
} from "godseye/plugin-sdk/config-runtime";
export type { OutboundReplyPayload } from "godseye/plugin-sdk/reply-payload";
export { DEFAULT_ACCOUNT_ID } from "godseye/plugin-sdk/account-id";
export { buildChannelConfigSchema } from "godseye/plugin-sdk/channel-config-primitives";
export {
  PAIRING_APPROVED_MESSAGE,
  buildBaseChannelStatusSummary,
} from "godseye/plugin-sdk/channel-status";
export { createChannelPairingController } from "godseye/plugin-sdk/channel-pairing";
export { createAccountStatusSink } from "godseye/plugin-sdk/channel-lifecycle";
export {
  readStoreAllowFromForDmPolicy,
  resolveEffectiveAllowFromLists,
} from "godseye/plugin-sdk/channel-policy";
export { resolveControlCommandGate } from "godseye/plugin-sdk/command-auth";
export { dispatchInboundReplyWithBase } from "godseye/plugin-sdk/inbound-reply-dispatch";
export { chunkTextForOutbound } from "godseye/plugin-sdk/text-chunking";
export {
  deliverFormattedTextWithAttachments,
  formatTextWithAttachmentLinks,
  resolveOutboundMediaUrls,
} from "godseye/plugin-sdk/reply-payload";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  isDangerousNameMatchingEnabled,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "godseye/plugin-sdk/config-runtime";
export { logInboundDrop } from "godseye/plugin-sdk/channel-inbound";
