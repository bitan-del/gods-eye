import { resolveChannelGroupRequireMention } from "godseye/plugin-sdk/channel-policy";
import type { GodsEyeConfig } from "godseye/plugin-sdk/core";

type GoogleChatGroupContext = {
  cfg: GodsEyeConfig;
  accountId?: string | null;
  groupId?: string | null;
};

export function resolveGoogleChatGroupRequireMention(params: GoogleChatGroupContext): boolean {
  return resolveChannelGroupRequireMention({
    cfg: params.cfg,
    channel: "googlechat",
    groupId: params.groupId,
    accountId: params.accountId,
  });
}
