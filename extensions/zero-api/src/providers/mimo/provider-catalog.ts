import type { ModelProviderConfig } from "godseye/plugin-sdk/provider-model-shared";
import { MIMO_WEB_MODEL_CATALOG } from "./models.js";

export const MIMO_WEB_BASE_URL = "http://127.0.0.1:64201/v1/zero-api/mimo-web";

export function buildMimoWebProvider(): ModelProviderConfig {
  return {
    baseUrl: MIMO_WEB_BASE_URL,
    api: "openai-completions",
    models: MIMO_WEB_MODEL_CATALOG,
  };
}
