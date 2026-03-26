import { describe, expect, it } from "vitest";
import { buildPlatformRuntimeLogHints, buildPlatformServiceStartHints } from "./runtime-hints.js";

describe("buildPlatformRuntimeLogHints", () => {
  it("renders launchd log hints on darwin", () => {
    expect(
      buildPlatformRuntimeLogHints({
        platform: "darwin",
        env: {
          GODSEYE_STATE_DIR: "/tmp/godseye-state",
          GODSEYE_LOG_PREFIX: "gateway",
        },
        systemdServiceName: "godseye-gateway",
        windowsTaskName: "GodsEye Gateway",
      }),
    ).toEqual([
      "Launchd stdout (if installed): /tmp/godseye-state/logs/gateway.log",
      "Launchd stderr (if installed): /tmp/godseye-state/logs/gateway.err.log",
    ]);
  });

  it("renders systemd and windows hints by platform", () => {
    expect(
      buildPlatformRuntimeLogHints({
        platform: "linux",
        systemdServiceName: "godseye-gateway",
        windowsTaskName: "GodsEye Gateway",
      }),
    ).toEqual(["Logs: journalctl --user -u godseye-gateway.service -n 200 --no-pager"]);
    expect(
      buildPlatformRuntimeLogHints({
        platform: "win32",
        systemdServiceName: "godseye-gateway",
        windowsTaskName: "GodsEye Gateway",
      }),
    ).toEqual(['Logs: schtasks /Query /TN "GodsEye Gateway" /V /FO LIST']);
  });
});

describe("buildPlatformServiceStartHints", () => {
  it("builds platform-specific service start hints", () => {
    expect(
      buildPlatformServiceStartHints({
        platform: "darwin",
        installCommand: "godseye gateway install",
        startCommand: "godseye gateway",
        launchAgentPlistPath: "~/Library/LaunchAgents/com.godseye.gateway.plist",
        systemdServiceName: "godseye-gateway",
        windowsTaskName: "GodsEye Gateway",
      }),
    ).toEqual([
      "godseye gateway install",
      "godseye gateway",
      "launchctl bootstrap gui/$UID ~/Library/LaunchAgents/com.godseye.gateway.plist",
    ]);
    expect(
      buildPlatformServiceStartHints({
        platform: "linux",
        installCommand: "godseye gateway install",
        startCommand: "godseye gateway",
        launchAgentPlistPath: "~/Library/LaunchAgents/com.godseye.gateway.plist",
        systemdServiceName: "godseye-gateway",
        windowsTaskName: "GodsEye Gateway",
      }),
    ).toEqual([
      "godseye gateway install",
      "godseye gateway",
      "systemctl --user start godseye-gateway.service",
    ]);
  });
});
