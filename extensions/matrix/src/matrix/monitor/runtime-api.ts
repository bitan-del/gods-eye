// Narrow Matrix monitor helper seam.
// Keep monitor internals off the broad package runtime-api barrel so monitor
// tests and shared workers do not pull unrelated Matrix helper surfaces.

export { ensureConfiguredAcpBindingReady } from "godseye/plugin-sdk/acp-binding-runtime";
export type { NormalizedLocation } from "godseye/plugin-sdk/channel-inbound";
export type { PluginRuntime, RuntimeLogger } from "godseye/plugin-sdk/plugin-runtime";
export type { BlockReplyContext, ReplyPayload } from "godseye/plugin-sdk/reply-runtime";
export type { MarkdownTableMode, OpenClawConfig } from "godseye/plugin-sdk/config-runtime";
export type { RuntimeEnv } from "godseye/plugin-sdk/runtime";
export {
  addAllowlistUserEntriesFromConfigEntry,
  buildAllowlistResolutionSummary,
  canonicalizeAllowlistWithResolvedIds,
  formatAllowlistMatchMeta,
  patchAllowlistUsersInConfigEntries,
  summarizeMapping,
} from "godseye/plugin-sdk/allow-from";
export { createReplyPrefixOptions } from "godseye/plugin-sdk/channel-reply-pipeline";
export { createTypingCallbacks } from "godseye/plugin-sdk/channel-reply-pipeline";
export {
  formatLocationText,
  logInboundDrop,
  toLocationContext,
} from "godseye/plugin-sdk/channel-inbound";
export { getAgentScopedMediaLocalRoots } from "godseye/plugin-sdk/agent-media-payload";
export { logTypingFailure, resolveAckReaction } from "godseye/plugin-sdk/channel-feedback";
export {
  buildChannelKeyCandidates,
  resolveChannelEntryMatch,
} from "godseye/plugin-sdk/channel-targets";
