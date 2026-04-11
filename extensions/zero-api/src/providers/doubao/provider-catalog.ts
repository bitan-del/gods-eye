import type { ModelProviderConfig } from "godseye/plugin-sdk/provider-model-shared";
import { DOUBAO_WEB_MODEL_CATALOG } from "./models.js";

export const DOUBAO_WEB_BASE_URL = "http://127.0.0.1:64201/v1/zero-api/doubao-web";

export function buildDoubaoWebProvider(): ModelProviderConfig {
  return {
    baseUrl: DOUBAO_WEB_BASE_URL,
    api: "openai-completions",
    models: DOUBAO_WEB_MODEL_CATALOG,
  };
}
