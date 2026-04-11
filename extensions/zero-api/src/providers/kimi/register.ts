import type { OpenClawPluginApi } from "godseye/plugin-sdk/plugin-entry";
import type {
  ProviderCatalogContext,
  ProviderCatalogResult,
} from "godseye/plugin-sdk/provider-catalog-shared";
import { ensureShimStarted } from "../../shim/server.js";
import { registerKimiWebHandler } from "./handler.js";
import { buildKimiWebProvider } from "./provider-catalog.js";

export function registerKimiWeb(api: OpenClawPluginApi): void {
  registerKimiWebHandler();
  api.registerProvider({
    id: "kimi-web",
    label: "Kimi (Web)",
    docsPath: "/providers/kimi-web",
    auth: [],
    catalog: {
      order: "simple",
      async run(_ctx: ProviderCatalogContext): Promise<ProviderCatalogResult> {
        await ensureShimStarted();
        return {
          provider: {
            ...buildKimiWebProvider(),
            apiKey: "zero-api-local-shim",
          },
        };
      },
    },
  });
}
