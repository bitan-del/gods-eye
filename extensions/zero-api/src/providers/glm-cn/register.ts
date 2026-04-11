import type { OpenClawPluginApi } from "godseye/plugin-sdk/plugin-entry";
import type {
  ProviderCatalogContext,
  ProviderCatalogResult,
} from "godseye/plugin-sdk/provider-catalog-shared";
import { ensureShimStarted } from "../../shim/server.js";
import { registerGlmCnWebHandler } from "./handler.js";
import { buildGlmCnWebProvider } from "./provider-catalog.js";

/**
 * Register the ChatGLM CN (chatglm.cn / 智谱清言) provider with the gateway
 * catalog and the zero-api shim handler registry.
 */
export function registerGlmCnWeb(api: OpenClawPluginApi): void {
  registerGlmCnWebHandler();
  api.registerProvider({
    id: "glm-cn-web",
    label: "ChatGLM CN (Web)",
    docsPath: "/providers/glm-cn-web",
    auth: [],
    catalog: {
      order: "simple",
      async run(_ctx: ProviderCatalogContext): Promise<ProviderCatalogResult> {
        await ensureShimStarted();
        return {
          provider: {
            ...buildGlmCnWebProvider(),
            apiKey: "zero-api-local-shim",
          },
        };
      },
    },
  });
}
