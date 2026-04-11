import type { ModelDefinitionConfig } from "godseye/plugin-sdk/provider-model-shared";

/**
 * Static DeepSeek Web model catalog.
 *
 * These IDs are the same names DeepSeek's public API uses, but the models
 * are actually served through the browser session shim (no tokens billed).
 */
export const DEEPSEEK_WEB_MODEL_CATALOG: ModelDefinitionConfig[] = [
  {
    id: "deepseek-chat",
    name: "DeepSeek Chat (Web)",
    api: "openai-completions",
    reasoning: false,
    input: ["text"],
    contextWindow: 65536,
    maxTokens: 8192,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  },
  {
    id: "deepseek-reasoner",
    name: "DeepSeek Reasoner (Web)",
    api: "openai-completions",
    reasoning: true,
    input: ["text"],
    contextWindow: 65536,
    maxTokens: 16384,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  },
];
