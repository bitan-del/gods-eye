import { defineSetupPluginEntry } from "godseye/plugin-sdk/core";
import { zalouserSetupPlugin } from "./src/channel.setup.js";

export { zalouserSetupPlugin } from "./src/channel.setup.js";

export default defineSetupPluginEntry(zalouserSetupPlugin);
