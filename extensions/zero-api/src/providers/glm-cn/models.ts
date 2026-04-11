import type { ModelDefinitionConfig } from "godseye/plugin-sdk/provider-model-shared";

export const GLM_CN_WEB_MODEL_CATALOG: ModelDefinitionConfig[] = [
  {
    id: "glm-4-plus",
    name: "GLM-4 Plus (CN Web)",
    api: "openai-completions",
    reasoning: false,
    input: ["text"],
    contextWindow: 128_000,
    maxTokens: 8192,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  },
  {
    id: "glm-4",
    name: "GLM-4 (CN Web)",
    api: "openai-completions",
    reasoning: false,
    input: ["text"],
    contextWindow: 128_000,
    maxTokens: 8192,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  },
  {
    id: "glm-4-think",
    name: "GLM-4 Think (CN Web)",
    api: "openai-completions",
    reasoning: true,
    input: ["text"],
    contextWindow: 128_000,
    maxTokens: 16_384,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  },
  {
    id: "glm-4-zero",
    name: "GLM-4 Zero (CN Web)",
    api: "openai-completions",
    reasoning: true,
    input: ["text"],
    contextWindow: 128_000,
    maxTokens: 16_384,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  },
];
