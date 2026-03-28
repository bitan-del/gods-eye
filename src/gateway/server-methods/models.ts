import { DEFAULT_PROVIDER } from "../../agents/defaults.js";
import { hasAvailableAuthForProvider } from "../../agents/model-auth.js";
import type { ModelCatalogEntry } from "../../agents/model-catalog.js";
import { buildAllowedModelSet } from "../../agents/model-selection.js";
import { loadConfig } from "../../config/config.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateModelsListParams,
} from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

/**
 * Filter model catalog to only include models from providers that have
 * configured credentials (API keys, OAuth tokens, env vars, etc.).
 * This prevents the dropdown from showing hundreds of unusable models.
 */
async function filterToAuthenticatedProviders(
  models: ModelCatalogEntry[],
): Promise<ModelCatalogEntry[]> {
  const providerAuthCache = new Map<string, boolean>();

  async function providerHasAuth(provider: string): Promise<boolean> {
    const normalized = provider.toLowerCase().trim();
    if (providerAuthCache.has(normalized)) {
      return providerAuthCache.get(normalized)!;
    }
    const hasAuth = await hasAvailableAuthForProvider({ provider: normalized });
    providerAuthCache.set(normalized, hasAuth);
    return hasAuth;
  }

  const results = await Promise.all(
    models.map(async (model) => ({
      model,
      hasAuth: await providerHasAuth(model.provider),
    })),
  );

  return results.filter((r) => r.hasAuth).map((r) => r.model);
}

export const modelsHandlers: GatewayRequestHandlers = {
  "models.list": async ({ params, respond, context }) => {
    if (!validateModelsListParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid models.list params: ${formatValidationErrors(validateModelsListParams.errors)}`,
        ),
      );
      return;
    }
    try {
      const catalog = await context.loadGatewayModelCatalog();
      const cfg = loadConfig();
      const { allowedCatalog } = buildAllowedModelSet({
        cfg,
        catalog,
        defaultProvider: DEFAULT_PROVIDER,
      });
      const allModels = allowedCatalog.length > 0 ? allowedCatalog : catalog;

      // Only show models from providers that have configured credentials
      const authenticatedModels = await filterToAuthenticatedProviders(allModels);

      // Fall back to full list if no authenticated providers found (avoid empty dropdown)
      const models = authenticatedModels.length > 0 ? authenticatedModels : allModels;

      respond(true, { models }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },
};
