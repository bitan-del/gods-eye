import { resolveApprovalOverGateway } from "godseye/plugin-sdk/approval-gateway-runtime";
import type { ExecApprovalReplyDecision } from "godseye/plugin-sdk/approval-runtime";
import type { OpenClawConfig } from "godseye/plugin-sdk/config-runtime";
import { isApprovalNotFoundError } from "godseye/plugin-sdk/error-runtime";

export { isApprovalNotFoundError };

export async function resolveMatrixApproval(params: {
  cfg: OpenClawConfig;
  approvalId: string;
  decision: ExecApprovalReplyDecision;
  senderId?: string | null;
  gatewayUrl?: string;
}): Promise<void> {
  await resolveApprovalOverGateway({
    cfg: params.cfg,
    approvalId: params.approvalId,
    decision: params.decision,
    senderId: params.senderId,
    gatewayUrl: params.gatewayUrl,
    clientDisplayName: `Matrix approval (${params.senderId?.trim() || "unknown"})`,
  });
}
