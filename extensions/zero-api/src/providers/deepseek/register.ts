import type { OpenClawPluginApi } from "godseye/plugin-sdk/plugin-entry";
import type {
  ProviderCatalogContext,
  ProviderCatalogResult,
} from "godseye/plugin-sdk/provider-catalog-shared";
import { ensureShimStarted } from "../../shim/server.js";
import { registerDeepSeekWebHandler } from "./handler.js";
import { buildDeepSeekWebProvider } from "./provider-catalog.js";

/**
 * Register the DeepSeek Web provider with the gateway catalog and the
 * zero-api shim handler registry.
 */
export function registerDeepSeekWeb(api: OpenClawPluginApi): void {
  registerDeepSeekWebHandler();
  api.registerProvider({
    id: "deepseek-web",
    label: "DeepSeek (Web)",
    docsPath: "/providers/deepseek-web",
    auth: [],
    catalog: {
      order: "simple",
      async run(_ctx: ProviderCatalogContext): Promise<ProviderCatalogResult> {
        await ensureShimStarted();
        return {
          provider: {
            ...buildDeepSeekWebProvider(),
            apiKey: "zero-api-local-shim",
          },
        };
      },
    },
  });
}
