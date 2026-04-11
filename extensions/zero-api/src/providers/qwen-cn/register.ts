import type { OpenClawPluginApi } from "godseye/plugin-sdk/plugin-entry";
import type {
  ProviderCatalogContext,
  ProviderCatalogResult,
} from "godseye/plugin-sdk/provider-catalog-shared";
import { ensureShimStarted } from "../../shim/server.js";
import { registerQwenCnWebHandler } from "./handler.js";
import { buildQwenCnWebProvider } from "./provider-catalog.js";

export function registerQwenCnWeb(api: OpenClawPluginApi): void {
  registerQwenCnWebHandler();
  api.registerProvider({
    id: "qwen-cn-web",
    label: "Qwen CN (Web)",
    docsPath: "/providers/qwen-cn-web",
    auth: [],
    catalog: {
      order: "simple",
      async run(_ctx: ProviderCatalogContext): Promise<ProviderCatalogResult> {
        await ensureShimStarted();
        return {
          provider: {
            ...buildQwenCnWebProvider(),
            apiKey: "zero-api-local-shim",
          },
        };
      },
    },
  });
}
