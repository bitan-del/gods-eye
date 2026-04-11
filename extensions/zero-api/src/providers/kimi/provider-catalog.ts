import type { ModelProviderConfig } from "godseye/plugin-sdk/provider-model-shared";
import { KIMI_WEB_MODEL_CATALOG } from "./models.js";

export const KIMI_WEB_BASE_URL = "http://127.0.0.1:64201/v1/zero-api/kimi-web";

export function buildKimiWebProvider(): ModelProviderConfig {
  return {
    baseUrl: KIMI_WEB_BASE_URL,
    api: "openai-completions",
    models: KIMI_WEB_MODEL_CATALOG,
  };
}
