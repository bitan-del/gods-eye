import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("./launchd.js");
});

describe("buildPlatformRuntimeLogHints", () => {
  it("strips windows drive prefixes from darwin display paths", async () => {
    vi.doMock("./launchd.js", () => ({
      resolveGatewayLogPaths: () => ({
        stdoutPath: "C:\\tmp\\godseye-state\\logs\\gateway.log",
        stderrPath: "C:\\tmp\\godseye-state\\logs\\gateway.err.log",
      }),
    }));

    const { buildPlatformRuntimeLogHints } = await import("./runtime-hints.js");

    expect(
      buildPlatformRuntimeLogHints({
        platform: "darwin",
        systemdServiceName: "godseye-gateway",
        windowsTaskName: "GodsEye Gateway",
      }),
    ).toEqual([
      "Launchd stdout (if installed): /tmp/godseye-state/logs/gateway.log",
      "Launchd stderr (if installed): /tmp/godseye-state/logs/gateway.err.log",
    ]);
  });
});
