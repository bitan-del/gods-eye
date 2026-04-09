import {
  createResolvedApproverActionAuthAdapter,
  resolveApprovalApprovers,
} from "godseye/plugin-sdk/approval-auth-runtime";
import { normalizeOptionalLowercaseString } from "godseye/plugin-sdk/text-runtime";
import { resolveFeishuAccount } from "./accounts.js";
import { normalizeFeishuTarget } from "./targets.js";

function normalizeFeishuApproverId(value: string | number): string | undefined {
  const normalized = normalizeFeishuTarget(String(value));
  const trimmed = normalizeOptionalLowercaseString(normalized);
  return trimmed?.startsWith("ou_") ? trimmed : undefined;
}

export const feishuApprovalAuth = createResolvedApproverActionAuthAdapter({
  channelLabel: "Feishu",
  resolveApprovers: ({ cfg, accountId }) => {
    const account = resolveFeishuAccount({ cfg, accountId }).config;
    return resolveApprovalApprovers({
      allowFrom: account.allowFrom,
      normalizeApprover: normalizeFeishuApproverId,
    });
  },
  normalizeSenderId: (value) => normalizeFeishuApproverId(value),
});
