// Private runtime barrel for the bundled Zalo Personal extension.
// Keep this barrel thin and aligned with the local extension surface.

export * from "./api.js";
export { setZalouserRuntime } from "./src/runtime.js";
export type { ReplyPayload } from "godseye/plugin-sdk/reply-runtime";
export type {
  BaseProbeResult,
  ChannelAccountSnapshot,
  ChannelDirectoryEntry,
  ChannelGroupContext,
  ChannelMessageActionAdapter,
  ChannelStatusIssue,
} from "godseye/plugin-sdk/channel-contract";
export type {
  OpenClawConfig,
  GroupToolPolicyConfig,
  MarkdownTableMode,
} from "godseye/plugin-sdk/config-runtime";
export type {
  PluginRuntime,
  AnyAgentTool,
  ChannelPlugin,
  OpenClawPluginToolContext,
} from "godseye/plugin-sdk/core";
export type { RuntimeEnv } from "godseye/plugin-sdk/runtime";
export {
  DEFAULT_ACCOUNT_ID,
  buildChannelConfigSchema,
  normalizeAccountId,
} from "godseye/plugin-sdk/core";
export { chunkTextForOutbound } from "godseye/plugin-sdk/text-chunking";
export {
  isDangerousNameMatchingEnabled,
  resolveDefaultGroupPolicy,
  resolveOpenProviderRuntimeGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "godseye/plugin-sdk/config-runtime";
export {
  mergeAllowlist,
  summarizeMapping,
  formatAllowFromLowercase,
} from "godseye/plugin-sdk/allow-from";
export { resolveInboundMentionDecision } from "godseye/plugin-sdk/channel-inbound";
export { createChannelPairingController } from "godseye/plugin-sdk/channel-pairing";
export { createChannelReplyPipeline } from "godseye/plugin-sdk/channel-reply-pipeline";
export { buildBaseAccountStatusSnapshot } from "godseye/plugin-sdk/status-helpers";
export { resolveSenderCommandAuthorization } from "godseye/plugin-sdk/command-auth";
export {
  evaluateGroupRouteAccessForPolicy,
  resolveSenderScopedGroupPolicy,
} from "godseye/plugin-sdk/group-access";
export { loadOutboundMediaFromUrl } from "godseye/plugin-sdk/outbound-media";
export {
  deliverTextOrMediaReply,
  isNumericTargetId,
  resolveSendableOutboundReplyParts,
  sendPayloadWithChunkedTextAndMedia,
  type OutboundReplyPayload,
} from "godseye/plugin-sdk/reply-payload";
export { resolvePreferredOpenClawTmpDir } from "godseye/plugin-sdk/browser-security-runtime";
