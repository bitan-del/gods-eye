import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GodsEyeConfig } from "../config/config.js";

const ensureGodsEyeModelsJsonMock = vi.fn<
  (config: unknown, agentDir: unknown) => Promise<{ agentDir: string; wrote: boolean }>
>(async () => ({ agentDir: "/tmp/agent", wrote: false }));
const resolveModelAsyncMock = vi.fn<
  (
    provider: unknown,
    modelId: unknown,
    agentDir: unknown,
    cfg: unknown,
    options?: unknown,
  ) => Promise<{ model: { id: string; provider: string; api: string } }>
>(async () => ({
  model: {
    id: "gpt-5.4",
    provider: "openai-codex",
    api: "openai-codex-responses",
  },
}));

vi.mock("../agents/agent-paths.js", () => ({
  resolveGodsEyeAgentDir: () => "/tmp/agent",
}));

vi.mock("../agents/models-config.js", () => ({
  ensureGodsEyeModelsJson: (config: unknown, agentDir: unknown) =>
    ensureGodsEyeModelsJsonMock(config, agentDir),
}));

vi.mock("../agents/pi-embedded-runner/model.js", () => ({
  resolveModelAsync: (
    provider: unknown,
    modelId: unknown,
    agentDir: unknown,
    cfg: unknown,
    options?: unknown,
  ) => resolveModelAsyncMock(provider, modelId, agentDir, cfg, options),
}));

describe("gateway startup primary model warmup", () => {
  beforeEach(() => {
    ensureGodsEyeModelsJsonMock.mockClear();
    resolveModelAsyncMock.mockClear();
  });

  it("prewarms an explicit configured primary model", async () => {
    const { __testing } = await import("./server-startup.js");
    const cfg = {
      agents: {
        defaults: {
          model: {
            primary: "openai-codex/gpt-5.4",
          },
        },
      },
    } as GodsEyeConfig;

    await __testing.prewarmConfiguredPrimaryModel({
      cfg,
      log: { warn: vi.fn() },
    });

    expect(ensureGodsEyeModelsJsonMock).toHaveBeenCalledWith(cfg, "/tmp/agent");
    expect(resolveModelAsyncMock).toHaveBeenCalledWith(
      "openai-codex",
      "gpt-5.4",
      "/tmp/agent",
      cfg,
      {
        retryTransientProviderRuntimeMiss: true,
      },
    );
  });

  it("skips warmup when no explicit primary model is configured", async () => {
    const { __testing } = await import("./server-startup.js");

    await __testing.prewarmConfiguredPrimaryModel({
      cfg: {} as GodsEyeConfig,
      log: { warn: vi.fn() },
    });

    expect(ensureGodsEyeModelsJsonMock).not.toHaveBeenCalled();
    expect(resolveModelAsyncMock).not.toHaveBeenCalled();
  });
});
