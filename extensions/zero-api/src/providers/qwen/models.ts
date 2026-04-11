import type { ModelDefinitionConfig } from "godseye/plugin-sdk/provider-model-shared";

/**
 * Static Qwen Web model catalog.
 *
 * These IDs mirror the public chat.qwen.ai model picker. They are served
 * through the browser session shim at zero-cost.
 */
export const QWEN_WEB_MODEL_CATALOG: ModelDefinitionConfig[] = [
  {
    id: "qwen3-max",
    name: "Qwen3 Max (Web)",
    api: "openai-completions",
    reasoning: false,
    input: ["text"],
    contextWindow: 131072,
    maxTokens: 8192,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  },
  {
    id: "qwen3-plus",
    name: "Qwen3 Plus (Web)",
    api: "openai-completions",
    reasoning: false,
    input: ["text"],
    contextWindow: 131072,
    maxTokens: 8192,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  },
  {
    id: "qwen3-turbo",
    name: "Qwen3 Turbo (Web)",
    api: "openai-completions",
    reasoning: false,
    input: ["text"],
    contextWindow: 131072,
    maxTokens: 8192,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  },
  {
    id: "qwq-32b",
    name: "QwQ 32B (Web)",
    api: "openai-completions",
    reasoning: true,
    input: ["text"],
    contextWindow: 131072,
    maxTokens: 16384,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  },
];
