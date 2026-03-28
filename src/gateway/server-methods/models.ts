import { DEFAULT_PROVIDER } from "../../agents/defaults.js";
import { hasAvailableAuthForProvider } from "../../agents/model-auth.js";
import { buildAllowedModelSet } from "../../agents/model-selection.js";
import { loadConfig } from "../../config/config.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateModelsListParams,
} from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

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
      const base = allowedCatalog.length > 0 ? allowedCatalog : catalog;

      // Filter to only show models from providers that have configured auth
      const providerAuthCache = new Map<string, boolean>();
      const authenticatedModels: typeof base = [];
      for (const model of base) {
        const provider = model.provider ?? model.id?.split("/")[0] ?? "";
        if (!provider) {
          authenticatedModels.push(model);
          continue;
        }
        if (!providerAuthCache.has(provider)) {
          providerAuthCache.set(provider, await hasAvailableAuthForProvider({ provider, cfg }));
        }
        if (providerAuthCache.get(provider)) {
          authenticatedModels.push(model);
        }
      }

      const models = authenticatedModels.length > 0 ? authenticatedModels : base;
      respond(true, { models }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },
};
