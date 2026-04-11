import type { ModelProviderConfig } from "godseye/plugin-sdk/provider-model-shared";
import { QWEN_CN_WEB_MODEL_CATALOG } from "./models.js";

export const QWEN_CN_WEB_BASE_URL = "http://127.0.0.1:64201/v1/zero-api/qwen-cn-web";

export function buildQwenCnWebProvider(): ModelProviderConfig {
  return {
    baseUrl: QWEN_CN_WEB_BASE_URL,
    api: "openai-completions",
    models: QWEN_CN_WEB_MODEL_CATALOG,
  };
}
