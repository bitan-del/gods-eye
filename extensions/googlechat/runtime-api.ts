// Private runtime barrel for the bundled Google Chat extension.
// Keep this barrel thin and avoid broad plugin-sdk surfaces during bootstrap.

export { DEFAULT_ACCOUNT_ID } from "godseye/plugin-sdk/account-id";
export {
  createActionGate,
  jsonResult,
  readNumberParam,
  readReactionParams,
  readStringParam,
} from "godseye/plugin-sdk/channel-actions";
export { buildChannelConfigSchema } from "godseye/plugin-sdk/channel-config-primitives";
export type {
  ChannelMessageActionAdapter,
  ChannelMessageActionName,
  ChannelStatusIssue,
} from "godseye/plugin-sdk/channel-contract";
export { missingTargetError } from "godseye/plugin-sdk/channel-feedback";
export {
  createAccountStatusSink,
  runPassiveAccountLifecycle,
} from "godseye/plugin-sdk/channel-lifecycle";
export { createChannelPairingController } from "godseye/plugin-sdk/channel-pairing";
export { createChannelReplyPipeline } from "godseye/plugin-sdk/channel-reply-pipeline";
export {
  evaluateGroupRouteAccessForPolicy,
  resolveDmGroupAccessWithLists,
  resolveSenderScopedGroupPolicy,
} from "godseye/plugin-sdk/channel-policy";
export { PAIRING_APPROVED_MESSAGE } from "godseye/plugin-sdk/channel-status";
export { chunkTextForOutbound } from "godseye/plugin-sdk/text-chunking";
export type { OpenClawConfig } from "godseye/plugin-sdk/config-runtime";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  isDangerousNameMatchingEnabled,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "godseye/plugin-sdk/config-runtime";
export { fetchRemoteMedia, resolveChannelMediaMaxBytes } from "godseye/plugin-sdk/media-runtime";
export { loadOutboundMediaFromUrl } from "godseye/plugin-sdk/outbound-media";
export type { PluginRuntime } from "godseye/plugin-sdk/runtime-store";
export { fetchWithSsrFGuard } from "godseye/plugin-sdk/ssrf-runtime";
export {
  GoogleChatConfigSchema,
  type GoogleChatAccountConfig,
  type GoogleChatConfig,
} from "godseye/plugin-sdk/googlechat-runtime-shared";
export { extractToolSend } from "godseye/plugin-sdk/tool-send";
export { resolveInboundMentionDecision } from "godseye/plugin-sdk/channel-inbound";
export { resolveInboundRouteEnvelopeBuilderWithRuntime } from "godseye/plugin-sdk/inbound-envelope";
export { resolveWebhookPath } from "godseye/plugin-sdk/webhook-path";
export {
  registerWebhookTargetWithPluginRoute,
  resolveWebhookTargetWithAuthOrReject,
  withResolvedWebhookRequestPipeline,
} from "godseye/plugin-sdk/webhook-targets";
export {
  createWebhookInFlightLimiter,
  readJsonWebhookBodyOrReject,
  type WebhookInFlightLimiter,
} from "godseye/plugin-sdk/webhook-request-guards";
export { setGoogleChatRuntime } from "./src/runtime.js";
