import type { ModelProviderConfig } from "godseye/plugin-sdk/provider-model-shared";
import { DEEPSEEK_WEB_MODEL_CATALOG } from "./models.js";

export const DEEPSEEK_WEB_BASE_URL = "http://127.0.0.1:64201/v1/zero-api/deepseek-web";

export function buildDeepSeekWebProvider(): ModelProviderConfig {
  return {
    baseUrl: DEEPSEEK_WEB_BASE_URL,
    api: "openai-completions",
    models: DEEPSEEK_WEB_MODEL_CATALOG,
  };
}
