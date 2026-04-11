import type { OpenClawPluginApi } from "godseye/plugin-sdk/plugin-entry";
import type {
  ProviderCatalogContext,
  ProviderCatalogResult,
} from "godseye/plugin-sdk/provider-catalog-shared";
import { ensureShimStarted } from "../../shim/server.js";
import { registerQwenWebHandler } from "./handler.js";
import { buildQwenWebProvider } from "./provider-catalog.js";

export function registerQwenWeb(api: OpenClawPluginApi): void {
  registerQwenWebHandler();
  api.registerProvider({
    id: "qwen-web",
    label: "Qwen (Web)",
    docsPath: "/providers/qwen-web",
    auth: [],
    catalog: {
      order: "simple",
      async run(_ctx: ProviderCatalogContext): Promise<ProviderCatalogResult> {
        await ensureShimStarted();
        return {
          provider: {
            ...buildQwenWebProvider(),
            apiKey: "zero-api-local-shim",
          },
        };
      },
    },
  });
}
