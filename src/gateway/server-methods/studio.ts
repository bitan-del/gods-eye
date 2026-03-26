// Studio RPC handlers — bridge the web UI controller calls to the
// gods-eye-studio extension's execution layer.

import { homedir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../../config/config.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import { formatForLog } from "../ws-log.js";
import type { GatewayRequestHandlers } from "./types.js";

// Lazy-loaded extension imports to avoid pulling the extension at gateway boot.
let _brainModule: typeof import("../../../extensions/gods-eye-studio/src/brain/memory.js") | null =
  null;
let _executeModule: typeof import("../../../extensions/gods-eye-studio/src/execute.js") | null =
  null;

async function loadBrainModule() {
  if (!_brainModule) {
    _brainModule = await import("../../../extensions/gods-eye-studio/src/brain/memory.js");
  }
  return _brainModule;
}

async function loadExecuteModule() {
  if (!_executeModule) {
    _executeModule = await import("../../../extensions/gods-eye-studio/src/execute.js");
  }
  return _executeModule;
}

const DEFAULT_BRAIN_PATH = join(homedir(), ".godseye", "brain");

/** Resolve a BrainMemory instance using the default path. */
async function resolveBrain() {
  const { BrainMemory } = await loadBrainModule();
  return new BrainMemory(DEFAULT_BRAIN_PATH);
}

/** Build a provider-config bag from the Gods Eye config (API keys, etc.). */
function resolveStudioCfg(): Record<string, unknown> {
  const cfg = loadConfig();
  return cfg as unknown as Record<string, unknown>;
}

export const studioHandlers: GatewayRequestHandlers = {
  // -----------------------------------------------------------------------
  // Image generation
  // -----------------------------------------------------------------------
  "studio.image.generate": async ({ params, respond }) => {
    const prompt = typeof params.prompt === "string" ? params.prompt.trim() : "";
    if (!prompt) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "studio.image.generate requires prompt"),
      );
      return;
    }
    try {
      const brain = await resolveBrain();
      const cfg = resolveStudioCfg();
      const exec = await loadExecuteModule();
      const result = await exec.executeImageGeneration(
        brain,
        {
          prompt,
          model: typeof params.model === "string" ? params.model : undefined,
          width: typeof params.width === "number" ? params.width : undefined,
          height: typeof params.height === "number" ? params.height : undefined,
          style: typeof params.style === "string" ? params.style : undefined,
        },
        cfg,
      );
      respond(true, result);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  // -----------------------------------------------------------------------
  // Video generation
  // -----------------------------------------------------------------------
  "studio.video.generate": async ({ params, respond }) => {
    const prompt = typeof params.prompt === "string" ? params.prompt.trim() : "";
    if (!prompt) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "studio.video.generate requires prompt"),
      );
      return;
    }
    try {
      const brain = await resolveBrain();
      const cfg = resolveStudioCfg();
      const exec = await loadExecuteModule();
      const result = await exec.executeVideoGeneration(
        brain,
        {
          prompt,
          model: typeof params.model === "string" ? params.model : undefined,
          duration: typeof params.duration === "number" ? params.duration : undefined,
          aspectRatio: typeof params.aspectRatio === "string" ? params.aspectRatio : undefined,
        },
        cfg,
      );
      respond(true, result);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  // -----------------------------------------------------------------------
  // Brand scan
  // -----------------------------------------------------------------------
  "studio.brand.scan": async ({ params, respond }) => {
    const source = typeof params.source === "string" ? params.source.trim() : "";
    const name = typeof params.name === "string" ? params.name.trim() : "";
    if (!source || !name) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "studio.brand.scan requires source and name"),
      );
      return;
    }
    try {
      const brain = await resolveBrain();
      const cfg = resolveStudioCfg();
      const exec = await loadExecuteModule();
      const result = await exec.executeBrandScan(
        brain,
        {
          source,
          name,
          setAsDefault: typeof params.setAsDefault === "boolean" ? params.setAsDefault : undefined,
        },
        cfg,
      );
      respond(true, result);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  // -----------------------------------------------------------------------
  // Calendar — create
  // -----------------------------------------------------------------------
  "studio.calendar.create": async ({ params, respond }) => {
    const date = typeof params.date === "string" ? params.date.trim() : "";
    if (!date) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "studio.calendar.create requires date"),
      );
      return;
    }
    try {
      const brain = await resolveBrain();
      const exec = await loadExecuteModule();
      const result = exec.executeCalendar(brain, {
        action: "create",
        date,
        platform: typeof params.platform === "string" ? params.platform : undefined,
        notes: typeof params.notes === "string" ? params.notes : undefined,
      });
      respond(true, result);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  // -----------------------------------------------------------------------
  // Calendar — update
  // -----------------------------------------------------------------------
  "studio.calendar.update": async ({ params, respond }) => {
    const slotId = typeof params.slotId === "string" ? params.slotId.trim() : "";
    if (!slotId) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "studio.calendar.update requires slotId"),
      );
      return;
    }
    try {
      const brain = await resolveBrain();
      const exec = await loadExecuteModule();
      const result = exec.executeCalendar(brain, {
        action: "update",
        slotId,
        status: typeof params.status === "string" ? params.status : undefined,
      });
      respond(true, result);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  // -----------------------------------------------------------------------
  // Calendar — list
  // -----------------------------------------------------------------------
  "studio.calendar.list": async ({ respond }) => {
    try {
      const brain = await resolveBrain();
      const exec = await loadExecuteModule();
      const result = exec.executeCalendar(brain, { action: "list" });
      respond(true, result);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  // -----------------------------------------------------------------------
  // Gallery — list recent generations
  // -----------------------------------------------------------------------
  "studio.gallery.list": async ({ respond }) => {
    try {
      const brain = await resolveBrain();
      const generations = brain.recentGenerations(50);
      respond(true, { generations });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
};
