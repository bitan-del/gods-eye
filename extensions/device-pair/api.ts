export {
  approveDevicePairing,
  clearDeviceBootstrapTokens,
  issueDeviceBootstrapToken,
  PAIRING_SETUP_BOOTSTRAP_PROFILE,
  listDevicePairing,
  revokeDeviceBootstrapToken,
  type DeviceBootstrapProfile,
} from "godseye/plugin-sdk/device-bootstrap";
export { definePluginEntry, type GodsEyePluginApi } from "godseye/plugin-sdk/plugin-entry";
export {
  resolveGatewayBindUrl,
  resolveGatewayPort,
  resolveTailnetHostWithRunner,
} from "godseye/plugin-sdk/core";
export {
  resolvePreferredGodsEyeTmpDir,
  runPluginCommandWithTimeout,
} from "godseye/plugin-sdk/sandbox";
export { renderQrPngBase64 } from "./qr-image.js";
