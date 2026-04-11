import type { ModelDefinitionConfig } from "godseye/plugin-sdk/provider-model-shared";

/**
 * Static Qwen CN (通义千问) Web model catalog.
 *
 * These IDs are what chat2.qianwen.com's internal API expects on its
 * `/api/v2/chat` endpoint. Served through the browser session shim.
 */
export const QWEN_CN_WEB_MODEL_CATALOG: ModelDefinitionConfig[] = [
  {
    id: "Qwen3.5-Plus",
    name: "Qwen3.5 Plus (国内版)",
    api: "openai-completions",
    reasoning: false,
    input: ["text"],
    contextWindow: 131072,
    maxTokens: 8192,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  },
  {
    id: "Qwen3.5-Turbo",
    name: "Qwen3.5 Turbo (国内版)",
    api: "openai-completions",
    reasoning: false,
    input: ["text"],
    contextWindow: 32768,
    maxTokens: 4096,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  },
];
