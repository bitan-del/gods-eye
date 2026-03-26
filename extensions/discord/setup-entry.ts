import { defineSetupPluginEntry } from "godseye/plugin-sdk/core";
import { discordSetupPlugin } from "./src/channel.setup.js";

export { discordSetupPlugin } from "./src/channel.setup.js";

export default defineSetupPluginEntry(discordSetupPlugin);
