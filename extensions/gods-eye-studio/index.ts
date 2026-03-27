// Gods Eye Studio — unified creative brain extension.
// Registers all creative tools, injects brand/memory context into every
// agent call, and persists all creative state in the brain.
// Tool execution routes through src/execute.ts which calls the real
// provider APIs (fal, Gemini, OpenAI) and records results in the brain.

import { join } from "node:path";
import { definePluginEntry, type AnyAgentTool } from "godseye/plugin-sdk/plugin-entry";
import { buildCreativeContext, renderCreativeContextPrompt } from "./src/brain/context-builder.js";
import { BrainMemory } from "./src/brain/memory.js";
import { buildBrandScanToolDef } from "./src/tools/brand-scan.js";
import { buildCalendarToolDef } from "./src/tools/content-calendar.js";
import { buildImageGenToolDef } from "./src/tools/image-gen.js";
import { buildRecallToolDef } from "./src/tools/recall.js";
import { buildVideoGenToolDef } from "./src/tools/video-gen.js";

const PLUGIN_ID = "gods-eye-studio";
const DEFAULT_BRAIN_PATH = "~/.godseye/brain";

function resolveBrainPath(config: Record<string, unknown>): string {
  const studioConfig = config as {
    brain?: { memoryDbPath?: string };
  };
  const raw = studioConfig.brain?.memoryDbPath ?? DEFAULT_BRAIN_PATH;
  if (raw.startsWith("~/")) {
    const home = process.env.HOME ?? process.env.USERPROFILE ?? "/tmp";
    return join(home, raw.slice(2));
  }
  return raw;
}

export default definePluginEntry({
  id: PLUGIN_ID,
  name: "Gods Eye Studio",
  description:
    "Unified creative brain — image generation, video generation, brand intelligence, content calendar, and persistent creative memory. One brain, always aware.",

  register(api) {
    // Auth for fal + google is declared in godseye.plugin.json (authChoices).
    // No runtime registerAuthMethod call needed — the manifest handles it.

    // -- Initialize the Brain -----------------------------------------------

    let brainInstance: BrainMemory | undefined;
    function getBrain(config: Record<string, unknown>): BrainMemory {
      if (!brainInstance) {
        brainInstance = new BrainMemory(resolveBrainPath(config));
      }
      return brainInstance;
    }

    // -- Register creative tools with execution handlers --------------------
    // Each tool returns its schema definition AND an execute handler that
    // routes through the provider layer and records in the brain.

    api.registerTool(
      (ctx) => {
        const brain = getBrain((ctx.config as Record<string, unknown> | undefined) ?? {});
        const def = buildImageGenToolDef(brain);
        return {
          ...def,
          label: "Generate Image",
          async execute(_toolCallId: string, params: Record<string, unknown>) {
            const { executeImageGeneration } = await import("./src/execute.js");
            return executeImageGeneration(
              brain,
              {
                prompt: String(params.prompt ?? ""),
                model: params.model ? String(params.model) : undefined,
                width: params.width ? Number(params.width) : undefined,
                height: params.height ? Number(params.height) : undefined,
                style: params.style ? String(params.style) : undefined,
                negativePrompt: params.negativePrompt ? String(params.negativePrompt) : undefined,
                tags: params.tags ? String(params.tags) : undefined,
              },
              ctx.config,
            );
          },
        } as unknown as AnyAgentTool;
      },
      { names: ["studio_image_generate"] },
    );

    api.registerTool(
      (ctx) => {
        const brain = getBrain((ctx.config as Record<string, unknown> | undefined) ?? {});
        const def = buildVideoGenToolDef(brain);
        return {
          ...def,
          label: "Generate Video",
          async execute(_toolCallId: string, params: Record<string, unknown>) {
            const { executeVideoGeneration } = await import("./src/execute.js");
            return executeVideoGeneration(
              brain,
              {
                prompt: String(params.prompt ?? ""),
                model: params.model ? String(params.model) : undefined,
                duration: params.duration ? Number(params.duration) : undefined,
                aspectRatio: params.aspectRatio ? String(params.aspectRatio) : undefined,
                tags: params.tags ? String(params.tags) : undefined,
              },
              ctx.config,
            );
          },
        } as unknown as AnyAgentTool;
      },
      { names: ["studio_video_generate"] },
    );

    api.registerTool(
      (ctx) => {
        const brain = getBrain((ctx.config as Record<string, unknown> | undefined) ?? {});
        const def = buildBrandScanToolDef();
        return {
          ...def,
          label: "Brand Scan",
          async execute(_toolCallId: string, params: Record<string, unknown>) {
            const { executeBrandScan } = await import("./src/execute.js");
            return executeBrandScan(
              brain,
              {
                source: String(params.source ?? ""),
                name: String(params.name ?? ""),
                setAsDefault: params.setAsDefault !== false,
              },
              ctx.config,
            );
          },
        } as unknown as AnyAgentTool;
      },
      { names: ["studio_brand_scan"] },
    );

    api.registerTool(
      (ctx) => {
        const brain = getBrain((ctx.config as Record<string, unknown> | undefined) ?? {});
        const def = buildCalendarToolDef();
        return {
          ...def,
          label: "Content Calendar",
          execute(_toolCallId: string, params: Record<string, unknown>) {
            const { executeCalendar } =
              require("./src/execute.js") as typeof import("./src/execute.js");
            return executeCalendar(brain, {
              action: String(params.action ?? "list"),
              date: params.date ? String(params.date) : undefined,
              platform: params.platform ? String(params.platform) : undefined,
              status: params.status ? String(params.status) : undefined,
              slotId: params.slotId ? String(params.slotId) : undefined,
              generationId: params.generationId ? String(params.generationId) : undefined,
              notes: params.notes ? String(params.notes) : undefined,
            });
          },
        } as unknown as AnyAgentTool;
      },
      { names: ["studio_calendar"] },
    );

    api.registerTool(
      (ctx) => {
        const brain = getBrain((ctx.config as Record<string, unknown> | undefined) ?? {});
        const def = buildRecallToolDef();
        return {
          ...def,
          label: "Studio Recall",
          execute(_toolCallId: string, params: Record<string, unknown>) {
            const { executeStudioRecall } =
              require("./src/execute.js") as typeof import("./src/execute.js");
            return executeStudioRecall(brain, {
              query: String(params.query ?? ""),
              type: params.type ? String(params.type) : undefined,
              limit: params.limit ? Number(params.limit) : undefined,
            });
          },
        } as unknown as AnyAgentTool;
      },
      { names: ["studio_recall"] },
    );

    // -- Inject creative context into every agent prompt --------------------

    api.registerMemoryPromptSection(({ availableTools }) => {
      const studioTools = [
        "studio_image_generate",
        "studio_video_generate",
        "studio_brand_scan",
        "studio_calendar",
        "studio_recall",
      ];
      const hasStudioTool = studioTools.some((t) => availableTools.has(t));
      if (!hasStudioTool) return [];

      try {
        const brain = getBrain({});
        const ctx = buildCreativeContext(brain);
        return renderCreativeContextPrompt(ctx);
      } catch {
        return [];
      }
    });
  },
});
