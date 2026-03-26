export type MatrixManagedDeviceInfo = {
  deviceId: string;
  displayName: string | null;
  current: boolean;
};

export type MatrixDeviceHealthSummary = {
  currentDeviceId: string | null;
  staleGodsEyeDevices: MatrixManagedDeviceInfo[];
  currentGodsEyeDevices: MatrixManagedDeviceInfo[];
};

const GODSEYE_DEVICE_NAME_PREFIX = "GodsEye ";

export function isGodsEyeManagedMatrixDevice(displayName: string | null | undefined): boolean {
  return displayName?.startsWith(GODSEYE_DEVICE_NAME_PREFIX) === true;
}

export function summarizeMatrixDeviceHealth(
  devices: MatrixManagedDeviceInfo[],
): MatrixDeviceHealthSummary {
  const currentDeviceId = devices.find((device) => device.current)?.deviceId ?? null;
  const godsEyeDevices = devices.filter((device) =>
    isGodsEyeManagedMatrixDevice(device.displayName),
  );
  return {
    currentDeviceId,
    staleGodsEyeDevices: godsEyeDevices.filter((device) => !device.current),
    currentGodsEyeDevices: godsEyeDevices.filter((device) => device.current),
  };
}
