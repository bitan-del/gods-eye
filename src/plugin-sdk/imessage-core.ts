export type { ChannelPlugin } from "./channel-plugin-common.js";
export {
  DEFAULT_ACCOUNT_ID,
  buildChannelConfigSchema,
  deleteAccountFromConfigSection,
  getChatChannelMeta,
  setAccountEnabledInConfigSection,
} from "./channel-plugin-common.js";
export { formatTrimmedAllowFromEntries } from "./channel-config-helpers.js";
export {
  resolveIMessageConfigAllowFrom,
  resolveIMessageConfigDefaultTo,
} from "../../extensions/imessage/src/config-accessors.js";
export { IMessageConfigSchema } from "../config/zod-schema.providers-core.js";
export {
  parseChatAllowTargetPrefixes,
  parseChatTargetPrefixesOrThrow,
  resolveServicePrefixedAllowTarget,
  resolveServicePrefixedTarget,
  type ParsedChatTarget,
} from "../channels/plugins/chat-target-prefixes.js";
