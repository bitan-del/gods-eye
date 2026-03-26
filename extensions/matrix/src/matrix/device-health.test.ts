import { describe, expect, it } from "vitest";
import { isGodsEyeManagedMatrixDevice, summarizeMatrixDeviceHealth } from "./device-health.js";

describe("matrix device health", () => {
  it("detects GodsEye-managed device names", () => {
    expect(isGodsEyeManagedMatrixDevice("GodsEye Gateway")).toBe(true);
    expect(isGodsEyeManagedMatrixDevice("GodsEye Debug")).toBe(true);
    expect(isGodsEyeManagedMatrixDevice("Element iPhone")).toBe(false);
    expect(isGodsEyeManagedMatrixDevice(null)).toBe(false);
  });

  it("summarizes stale GodsEye-managed devices separately from the current device", () => {
    const summary = summarizeMatrixDeviceHealth([
      {
        deviceId: "du314Zpw3A",
        displayName: "GodsEye Gateway",
        current: true,
      },
      {
        deviceId: "BritdXC6iL",
        displayName: "GodsEye Gateway",
        current: false,
      },
      {
        deviceId: "G6NJU9cTgs",
        displayName: "GodsEye Debug",
        current: false,
      },
      {
        deviceId: "phone123",
        displayName: "Element iPhone",
        current: false,
      },
    ]);

    expect(summary.currentDeviceId).toBe("du314Zpw3A");
    expect(summary.currentGodsEyeDevices).toEqual([
      expect.objectContaining({ deviceId: "du314Zpw3A" }),
    ]);
    expect(summary.staleGodsEyeDevices).toEqual([
      expect.objectContaining({ deviceId: "BritdXC6iL" }),
      expect.objectContaining({ deviceId: "G6NJU9cTgs" }),
    ]);
  });
});
