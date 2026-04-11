import type { ModelProviderConfig } from "godseye/plugin-sdk/provider-model-shared";
import { GLM_CN_WEB_MODEL_CATALOG } from "./models.js";

export const GLM_CN_WEB_BASE_URL = "http://127.0.0.1:64201/v1/zero-api/glm-cn-web";

export function buildGlmCnWebProvider(): ModelProviderConfig {
  return {
    baseUrl: GLM_CN_WEB_BASE_URL,
    api: "openai-completions",
    models: GLM_CN_WEB_MODEL_CATALOG,
  };
}
