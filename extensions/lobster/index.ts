import { definePluginEntry } from "godseye/plugin-sdk/plugin-entry";
import type { AnyAgentTool, GodsEyePluginApi, GodsEyePluginToolFactory } from "./runtime-api.js";
import { createLobsterTool } from "./src/lobster-tool.js";

export default definePluginEntry({
  id: "lobster",
  name: "Lobster",
  description: "Optional local shell helper tools",
  register(api: GodsEyePluginApi) {
    api.registerTool(
      ((ctx) => {
        if (ctx.sandboxed) {
          return null;
        }
        return createLobsterTool(api) as AnyAgentTool;
      }) as GodsEyePluginToolFactory,
      { optional: true },
    );
  },
});
