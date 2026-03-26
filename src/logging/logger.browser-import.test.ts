import { afterEach, describe, expect, it, vi } from "vitest";

type LoggerModule = typeof import("./logger.js");

const originalGetBuiltinModule = (
  process as NodeJS.Process & { getBuiltinModule?: (id: string) => unknown }
).getBuiltinModule;

async function importBrowserSafeLogger(params?: {
  resolvePreferredGodsEyeTmpDir?: ReturnType<typeof vi.fn>;
}): Promise<{
  module: LoggerModule;
  resolvePreferredGodsEyeTmpDir: ReturnType<typeof vi.fn>;
}> {
  vi.resetModules();
  const resolvePreferredGodsEyeTmpDir =
    params?.resolvePreferredGodsEyeTmpDir ??
    vi.fn(() => {
      throw new Error("resolvePreferredGodsEyeTmpDir should not run during browser-safe import");
    });

  vi.doMock("../infra/tmp-godseye-dir.js", async () => {
    const actual = await vi.importActual<typeof import("../infra/tmp-godseye-dir.js")>(
      "../infra/tmp-godseye-dir.js",
    );
    return {
      ...actual,
      resolvePreferredGodsEyeTmpDir,
    };
  });

  Object.defineProperty(process, "getBuiltinModule", {
    configurable: true,
    value: undefined,
  });

  const module = await import("./logger.js");
  return { module, resolvePreferredGodsEyeTmpDir };
}

describe("logging/logger browser-safe import", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("../infra/tmp-godseye-dir.js");
    Object.defineProperty(process, "getBuiltinModule", {
      configurable: true,
      value: originalGetBuiltinModule,
    });
  });

  it("does not resolve the preferred temp dir at import time when node fs is unavailable", async () => {
    const { module, resolvePreferredGodsEyeTmpDir } = await importBrowserSafeLogger();

    expect(resolvePreferredGodsEyeTmpDir).not.toHaveBeenCalled();
    expect(module.DEFAULT_LOG_DIR).toBe("/tmp/godseye");
    expect(module.DEFAULT_LOG_FILE).toBe("/tmp/godseye/godseye.log");
  });

  it("disables file logging when imported in a browser-like environment", async () => {
    const { module, resolvePreferredGodsEyeTmpDir } = await importBrowserSafeLogger();

    expect(module.getResolvedLoggerSettings()).toMatchObject({
      level: "silent",
      file: "/tmp/godseye/godseye.log",
    });
    expect(module.isFileLogLevelEnabled("info")).toBe(false);
    expect(() => module.getLogger().info("browser-safe")).not.toThrow();
    expect(resolvePreferredGodsEyeTmpDir).not.toHaveBeenCalled();
  });
});
