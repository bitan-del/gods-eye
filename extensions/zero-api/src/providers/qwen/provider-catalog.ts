import type { ModelProviderConfig } from "godseye/plugin-sdk/provider-model-shared";
import { QWEN_WEB_MODEL_CATALOG } from "./models.js";

export const QWEN_WEB_BASE_URL = "http://127.0.0.1:64201/v1/zero-api/qwen-web";

export function buildQwenWebProvider(): ModelProviderConfig {
  return {
    baseUrl: QWEN_WEB_BASE_URL,
    api: "openai-completions",
    models: QWEN_WEB_MODEL_CATALOG,
  };
}
