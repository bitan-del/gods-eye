import { detectCliBackends } from "../../infra/cli-detect.js";
import type { GatewayRequestHandlers } from "./types.js";

export const cliHandlers: GatewayRequestHandlers = {
  "cli.detect": async ({ params, respond }) => {
    const force = params.force === true;
    try {
      const result = await detectCliBackends(force);
      respond(true, result, undefined);
    } catch {
      respond(true, { backends: [], detectedAt: Date.now() }, undefined);
    }
  },
};
