import { DEFAULT_PROVIDER } from "../../agents/defaults.js";
import { hasAvailableAuthForProvider } from "../../agents/model-auth.js";
import { buildAllowedModelSet } from "../../agents/model-selection.js";
import { loadConfig } from "../../config/config.js";
import { detectCliBackends } from "../../infra/cli-detect.js";
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

      // Inject locally detected CLI backends as virtual model entries
      try {
        const cliResult = await detectCliBackends();
        for (const backend of cliResult.backends) {
          if (!backend.available) {
            continue;
          }
          const alreadyListed = models.some(
            (m) => m.id === backend.id || m.provider === backend.id,
          );
          if (!alreadyListed) {
            models.push({
              id: backend.command === "claude" ? "sonnet" : backend.command,
              name: `${backend.command === "claude" ? "Claude Code" : backend.command} (Local Terminal)`,
              provider: backend.id,
              contextWindow: 200_000,
              reasoning: true,
            });
          }
        }
      } catch {
        // CLI detection is best-effort; don't fail the catalog
      }

      respond(true, { models }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },
};
