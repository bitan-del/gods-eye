import type { ModelDefinitionConfig } from "godseye/plugin-sdk/provider-model-shared";

/**
 * Static Xiaomi MiMo Web model catalog.
 *
 * IDs mirror the upstream xiaomimo-web-client-browser.ts discoverModels()
 * list. The canonical Xiaomi-internal model name is mapped at runtime in
 * `mimo-client.ts` via `MODEL_MAP`.
 */
export const MIMO_WEB_MODEL_CATALOG: ModelDefinitionConfig[] = [
  {
    id: "xiaomimo-chat",
    name: "Xiaomi MiMo Chat (Web)",
    api: "openai-completions",
    reasoning: false,
    input: ["text"],
    contextWindow: 128000,
    maxTokens: 4096,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  },
  {
    id: "mimo-v2-pro",
    name: "Xiaomi MiMo V2 Pro (Web)",
    api: "openai-completions",
    reasoning: true,
    input: ["text"],
    contextWindow: 128000,
    maxTokens: 8192,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  },
];
