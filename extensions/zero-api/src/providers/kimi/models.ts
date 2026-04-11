import type { ModelDefinitionConfig } from "godseye/plugin-sdk/provider-model-shared";

/**
 * Static Kimi (Moonshot) Web model catalog.
 *
 * Kimi's web UI exposes a handful of scenario-based models: K2 (default
 * chat), K1 (the earlier reasoning-capable series), search-augmented chat,
 * and research mode. The model id encodes which `scenario` the client
 * should hand Connect-RPC.
 */
export const KIMI_WEB_MODEL_CATALOG: ModelDefinitionConfig[] = [
  {
    id: "kimi-k2",
    name: "Kimi K2 (Web)",
    api: "openai-completions",
    reasoning: false,
    input: ["text"],
    contextWindow: 200000,
    maxTokens: 8192,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  },
  {
    id: "kimi-k1",
    name: "Kimi K1 (Web)",
    api: "openai-completions",
    reasoning: true,
    input: ["text"],
    contextWindow: 200000,
    maxTokens: 8192,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  },
  {
    id: "kimi-search",
    name: "Kimi Search (Web)",
    api: "openai-completions",
    reasoning: false,
    input: ["text"],
    contextWindow: 200000,
    maxTokens: 8192,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  },
  {
    id: "kimi-research",
    name: "Kimi Research (Web)",
    api: "openai-completions",
    reasoning: false,
    input: ["text"],
    contextWindow: 200000,
    maxTokens: 8192,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  },
];
