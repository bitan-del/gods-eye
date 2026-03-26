import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GodsEyeConfig } from "../../config/config.js";

const mocks = vi.hoisted(() => ({
  readConfigFileSnapshot: vi.fn(),
  writeConfigFile: vi.fn(),
}));

vi.mock("../../config/config.js", () => ({
  readConfigFileSnapshot: (...args: unknown[]) => mocks.readConfigFileSnapshot(...args),
  writeConfigFile: (...args: unknown[]) => mocks.writeConfigFile(...args),
}));

let loadValidConfigOrThrow: typeof import("./shared.js").loadValidConfigOrThrow;
let updateConfig: typeof import("./shared.js").updateConfig;

describe("models/shared", () => {
  beforeEach(async () => {
    vi.resetModules();
    mocks.readConfigFileSnapshot.mockClear();
    mocks.writeConfigFile.mockClear();
    ({ loadValidConfigOrThrow, updateConfig } = await import("./shared.js"));
  });

  it("returns config when snapshot is valid", async () => {
    const cfg = { providers: {} } as unknown as GodsEyeConfig;
    mocks.readConfigFileSnapshot.mockResolvedValue({
      valid: true,
      config: cfg,
    });

    await expect(loadValidConfigOrThrow()).resolves.toBe(cfg);
  });

  it("throws formatted issues when snapshot is invalid", async () => {
    mocks.readConfigFileSnapshot.mockResolvedValue({
      valid: false,
      path: "/tmp/godseye.json",
      issues: [{ path: "providers.openai.apiKey", message: "Required" }],
    });

    await expect(loadValidConfigOrThrow()).rejects.toThrowError(
      "Invalid config at /tmp/godseye.json\n- providers.openai.apiKey: Required",
    );
  });

  it("updateConfig writes mutated config", async () => {
    const cfg = { update: { channel: "stable" } } as unknown as GodsEyeConfig;
    mocks.readConfigFileSnapshot.mockResolvedValue({
      valid: true,
      config: cfg,
    });
    mocks.writeConfigFile.mockResolvedValue(undefined);

    await updateConfig((current) => ({
      ...current,
      update: { channel: "beta" },
    }));

    expect(mocks.writeConfigFile).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { channel: "beta" },
      }),
    );
  });
});
