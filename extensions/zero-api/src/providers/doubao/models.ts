import type { ModelDefinitionConfig } from "godseye/plugin-sdk/provider-model-shared";

/**
 * Static Doubao (www.doubao.com) model catalog.
 *
 * Doubao's web UI does not expose granular model ids in the API; the
 * server routes requests based on the user's active selection in the
 * UI. We expose `doubao-seed-2.0` (matching the upstream reference) and
 * `doubao-pro` as common labels so the gateway can route by id.
 */
export const DOUBAO_WEB_MODEL_CATALOG: ModelDefinitionConfig[] = [
  {
    id: "doubao-seed-2.0",
    name: "Doubao Seed 2.0 (Web)",
    api: "openai-completions",
    reasoning: true,
    input: ["text"],
    contextWindow: 64_000,
    maxTokens: 8192,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  },
  {
    id: "doubao-pro",
    name: "Doubao Pro (Web)",
    api: "openai-completions",
    reasoning: false,
    input: ["text"],
    contextWindow: 64_000,
    maxTokens: 8192,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  },
];
