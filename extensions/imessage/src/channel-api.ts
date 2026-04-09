import { formatTrimmedAllowFromEntries } from "godseye/plugin-sdk/channel-config-helpers";
import type { ChannelStatusIssue } from "godseye/plugin-sdk/channel-contract";
import { PAIRING_APPROVED_MESSAGE } from "godseye/plugin-sdk/channel-status";
import {
  DEFAULT_ACCOUNT_ID,
  getChatChannelMeta,
  type ChannelPlugin,
  type OpenClawConfig,
} from "godseye/plugin-sdk/core";
import { resolveChannelMediaMaxBytes } from "godseye/plugin-sdk/media-runtime";
import { collectStatusIssuesFromLastError } from "godseye/plugin-sdk/status-helpers";
import {
  resolveIMessageConfigAllowFrom,
  resolveIMessageConfigDefaultTo,
} from "./config-accessors.js";
import { looksLikeIMessageTargetId, normalizeIMessageMessagingTarget } from "./normalize.js";
export { chunkTextForOutbound } from "godseye/plugin-sdk/text-chunking";

export {
  collectStatusIssuesFromLastError,
  DEFAULT_ACCOUNT_ID,
  formatTrimmedAllowFromEntries,
  getChatChannelMeta,
  looksLikeIMessageTargetId,
  normalizeIMessageMessagingTarget,
  PAIRING_APPROVED_MESSAGE,
  resolveChannelMediaMaxBytes,
  resolveIMessageConfigAllowFrom,
  resolveIMessageConfigDefaultTo,
};

export type { ChannelPlugin, ChannelStatusIssue, OpenClawConfig };
