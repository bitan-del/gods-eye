import type { OpenClawPluginApi } from "godseye/plugin-sdk/plugin-entry";
import type {
  ProviderCatalogContext,
  ProviderCatalogResult,
} from "godseye/plugin-sdk/provider-catalog-shared";
import { ensureShimStarted } from "../../shim/server.js";
import { registerMimoWebHandler } from "./handler.js";
import { buildMimoWebProvider } from "./provider-catalog.js";

/**
 * Register the Xiaomi MiMo Web provider with the gateway catalog and the
 * zero-api shim handler registry.
 */
export function registerMimoWeb(api: OpenClawPluginApi): void {
  registerMimoWebHandler();
  api.registerProvider({
    id: "mimo-web",
    label: "Xiaomi MiMo (Web)",
    docsPath: "/providers/mimo-web",
    auth: [],
    catalog: {
      order: "simple",
      async run(_ctx: ProviderCatalogContext): Promise<ProviderCatalogResult> {
        await ensureShimStarted();
        return {
          provider: {
            ...buildMimoWebProvider(),
            apiKey: "zero-api-local-shim",
          },
        };
      },
    },
  });
}
