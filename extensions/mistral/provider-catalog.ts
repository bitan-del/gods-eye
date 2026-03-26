import type { ModelProviderConfig } from "godseye/plugin-sdk/provider-models";
import { buildMistralCatalogModels, MISTRAL_BASE_URL } from "./model-definitions.js";

export function buildMistralProvider(): ModelProviderConfig {
  return {
    baseUrl: MISTRAL_BASE_URL,
    api: "openai-completions",
    models: buildMistralCatalogModels(),
  };
}
