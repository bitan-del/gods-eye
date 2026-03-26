import { vi } from "vitest";
import { installChromeUserDataDirHooks } from "./chrome-user-data-dir.test-harness.js";

const chromeUserDataDir = { dir: "/tmp/godseye" };
installChromeUserDataDirHooks(chromeUserDataDir);

vi.mock("./chrome.js", () => ({
  isChromeCdpReady: vi.fn(async () => true),
  isChromeReachable: vi.fn(async () => true),
  launchGodsEyeChrome: vi.fn(async () => {
    throw new Error("unexpected launch");
  }),
  resolveGodsEyeUserDataDir: vi.fn(() => chromeUserDataDir.dir),
  stopGodsEyeChrome: vi.fn(async () => {}),
}));
