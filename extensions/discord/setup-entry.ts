import { defineBundledChannelSetupEntry } from "godseye/plugin-sdk/channel-entry-contract";

export default defineBundledChannelSetupEntry({
  importMetaUrl: import.meta.url,
  plugin: {
    specifier: "./setup-plugin-api.js",
    exportName: "discordSetupPlugin",
  },
});
