import type { OpenClawPluginApi } from "godseye/plugin-sdk/plugin-entry";
import type {
  ProviderCatalogContext,
  ProviderCatalogResult,
} from "godseye/plugin-sdk/provider-catalog-shared";
import { ensureShimStarted } from "../../shim/server.js";
import { registerDoubaoWebHandler } from "./handler.js";
import { buildDoubaoWebProvider } from "./provider-catalog.js";

/**
 * Register the Doubao (www.doubao.com / ByteDance) provider with the
 * gateway catalog and the zero-api shim handler registry.
 */
export function registerDoubaoWeb(api: OpenClawPluginApi): void {
  registerDoubaoWebHandler();
  api.registerProvider({
    id: "doubao-web",
    label: "Doubao (Web)",
    docsPath: "/providers/doubao-web",
    auth: [],
    catalog: {
      order: "simple",
      async run(_ctx: ProviderCatalogContext): Promise<ProviderCatalogResult> {
        await ensureShimStarted();
        return {
          provider: {
            ...buildDoubaoWebProvider(),
            apiKey: "zero-api-local-shim",
          },
        };
      },
    },
  });
}
