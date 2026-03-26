import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { resolveDefaultAgentId } from "../agents/agent-scope.js";
import {
  buildAllowedModelSet,
  isCliProvider,
  modelKey,
  parseModelRef,
  resolveDefaultModelForAgent,
} from "../agents/model-selection.js";
import { loadConfig } from "../config/config.js";
import { buildAgentMainSessionKey, normalizeAgentId } from "../routing/session-key.js";
import { normalizeMessageChannel } from "../utils/message-channel.js";
import { loadGatewayModelCatalog } from "./server-model-catalog.js";

export const GODSEYE_MODEL_ID = "godseye";
export const GODSEYE_DEFAULT_MODEL_ID = "godseye/default";

export function getHeader(req: IncomingMessage, name: string): string | undefined {
  const raw = req.headers[name.toLowerCase()];
  if (typeof raw === "string") {
    return raw;
  }
  if (Array.isArray(raw)) {
    return raw[0];
  }
  return undefined;
}

export function getBearerToken(req: IncomingMessage): string | undefined {
  const raw = getHeader(req, "authorization")?.trim() ?? "";
  if (!raw.toLowerCase().startsWith("bearer ")) {
    return undefined;
  }
  const token = raw.slice(7).trim();
  return token || undefined;
}

export function resolveAgentIdFromHeader(req: IncomingMessage): string | undefined {
  const raw =
    getHeader(req, "x-godseye-agent-id")?.trim() || getHeader(req, "x-godseye-agent")?.trim() || "";
  if (!raw) {
    return undefined;
  }
  return normalizeAgentId(raw);
}

export function resolveAgentIdFromModel(
  model: string | undefined,
  cfg = loadConfig(),
): string | undefined {
  const raw = model?.trim();
  if (!raw) {
    return undefined;
  }
  const lowered = raw.toLowerCase();
  if (lowered === GODSEYE_MODEL_ID || lowered === GODSEYE_DEFAULT_MODEL_ID) {
    return resolveDefaultAgentId(cfg);
  }

  const m =
    raw.match(/^godseye[:/](?<agentId>[a-z0-9][a-z0-9_-]{0,63})$/i) ??
    raw.match(/^agent:(?<agentId>[a-z0-9][a-z0-9_-]{0,63})$/i);
  const agentId = m?.groups?.agentId;
  if (!agentId) {
    return undefined;
  }
  return normalizeAgentId(agentId);
}

export async function resolveOpenAiCompatModelOverride(params: {
  req: IncomingMessage;
  agentId: string;
  model: string | undefined;
}): Promise<{ modelOverride?: string; errorMessage?: string }> {
  const requestModel = params.model?.trim();
  if (requestModel && !resolveAgentIdFromModel(requestModel)) {
    return {
      errorMessage: "Invalid `model`. Use `godseye` or `godseye/<agentId>`.",
    };
  }

  const raw = getHeader(params.req, "x-godseye-model")?.trim();
  if (!raw) {
    return {};
  }

  const cfg = loadConfig();
  const defaultModelRef = resolveDefaultModelForAgent({ cfg, agentId: params.agentId });
  const defaultProvider = defaultModelRef.provider;
  const parsed = parseModelRef(raw, defaultProvider);
  if (!parsed) {
    return { errorMessage: "Invalid `x-godseye-model`." };
  }

  const catalog = await loadGatewayModelCatalog();
  const allowed = buildAllowedModelSet({
    cfg,
    catalog,
    defaultProvider,
    agentId: params.agentId,
  });
  const normalized = modelKey(parsed.provider, parsed.model);
  if (
    !isCliProvider(parsed.provider, cfg) &&
    !allowed.allowAny &&
    !allowed.allowedKeys.has(normalized)
  ) {
    return {
      errorMessage: `Model '${normalized}' is not allowed for agent '${params.agentId}'.`,
    };
  }

  return { modelOverride: raw };
}

export function resolveAgentIdForRequest(params: {
  req: IncomingMessage;
  model: string | undefined;
}): string {
  const cfg = loadConfig();
  const fromHeader = resolveAgentIdFromHeader(params.req);
  if (fromHeader) {
    return fromHeader;
  }

  const fromModel = resolveAgentIdFromModel(params.model, cfg);
  return fromModel ?? resolveDefaultAgentId(cfg);
}

export function resolveSessionKey(params: {
  req: IncomingMessage;
  agentId: string;
  user?: string | undefined;
  prefix: string;
}): string {
  const explicit = getHeader(params.req, "x-godseye-session-key")?.trim();
  if (explicit) {
    return explicit;
  }

  const user = params.user?.trim();
  const mainKey = user ? `${params.prefix}-user:${user}` : `${params.prefix}:${randomUUID()}`;
  return buildAgentMainSessionKey({ agentId: params.agentId, mainKey });
}

export function resolveGatewayRequestContext(params: {
  req: IncomingMessage;
  model: string | undefined;
  user?: string | undefined;
  sessionPrefix: string;
  defaultMessageChannel: string;
  useMessageChannelHeader?: boolean;
}): { agentId: string; sessionKey: string; messageChannel: string } {
  const agentId = resolveAgentIdForRequest({ req: params.req, model: params.model });
  const sessionKey = resolveSessionKey({
    req: params.req,
    agentId,
    user: params.user,
    prefix: params.sessionPrefix,
  });

  const messageChannel = params.useMessageChannelHeader
    ? (normalizeMessageChannel(getHeader(params.req, "x-godseye-message-channel")) ??
      params.defaultMessageChannel)
    : params.defaultMessageChannel;

  return { agentId, sessionKey, messageChannel };
}
