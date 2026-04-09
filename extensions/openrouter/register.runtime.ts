import { createProviderApiKeyAuthMethod } from "godseye/plugin-sdk/provider-auth-api-key";
import {
  buildProviderReplayFamilyHooks,
  DEFAULT_CONTEXT_TOKENS,
} from "godseye/plugin-sdk/provider-model-shared";
import {
  buildProviderStreamFamilyHooks,
  createOpenRouterSystemCacheWrapper,
  createOpenRouterWrapper,
  getOpenRouterModelCapabilities,
  isProxyReasoningUnsupported,
  loadOpenRouterModelCapabilities,
} from "godseye/plugin-sdk/provider-stream-family";
import { openrouterMediaUnderstandingProvider } from "./media-understanding-provider.js";
import { applyOpenrouterConfig, OPENROUTER_DEFAULT_MODEL_REF } from "./onboard.js";
import { buildOpenrouterProvider } from "./provider-catalog.js";

export {
  applyOpenrouterConfig,
  buildOpenrouterProvider,
  buildProviderReplayFamilyHooks,
  buildProviderStreamFamilyHooks,
  createOpenRouterSystemCacheWrapper,
  createOpenRouterWrapper,
  createProviderApiKeyAuthMethod,
  DEFAULT_CONTEXT_TOKENS,
  getOpenRouterModelCapabilities,
  isProxyReasoningUnsupported,
  loadOpenRouterModelCapabilities,
  OPENROUTER_DEFAULT_MODEL_REF,
  openrouterMediaUnderstandingProvider,
};
