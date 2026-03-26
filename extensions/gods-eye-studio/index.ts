// Gods Eye Studio — unified creative brain extension.
// Registers all creative tools, injects brand/memory context into every
// agent call, and persists all creative state in the brain.

import { join } from "node:path";
import { definePluginEntry } from "godseye/plugin-sdk/plugin-entry";
import { createProviderApiKeyAuthMethod } from "godseye/plugin-sdk/provider-auth";
import { BrainMemory } from "./src/brain/memory.js";
import { buildCreativeContext, renderCreativeContextPrompt } from "./src/brain/context-builder.js";
import { buildImageGenToolDef } from "./src/tools/image-gen.js";
import { buildVideoGenToolDef } from "./src/tools/video-gen.js";
import { buildBrandScanToolDef } from "./src/tools/brand-scan.js";
import { buildCalendarToolDef } from "./src/tools/content-calendar.js";
import { buildRecallToolDef } from "./src/tools/recall.js";

const PLUGIN_ID = "gods-eye-studio";
const DEFAULT_BRAIN_PATH = "~/.godseye/brain";

function resolveBrainPath(config: Record<string, unknown>): string {
  const studioConfig = config as {
    brain?: { memoryDbPath?: string };
  };
  const raw = studioConfig.brain?.memoryDbPath ?? DEFAULT_BRAIN_PATH;
  // Expand ~ to home directory
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
  kind: "studio",

  register(api) {
    // -- Auth providers for creative APIs ----------------------------------

    api.registerAuthMethod({
      ...createProviderApiKeyAuthMethod({
        providerId: "fal",
        envVarNames: ["FAL_KEY"],
        wizard: {
          choiceId: "studio-fal-api-key",
          choiceLabel: "fal API key (image/video generation)",
          choiceHint: "Powers image and video generation in Gods Eye Studio",
          groupId: PLUGIN_ID,
          groupLabel: "Gods Eye Studio",
          groupHint: "Creative tools (image gen, video gen, brand intelligence)",
          onboardingScopes: ["image-generation"],
        },
      }),
    });

    api.registerAuthMethod({
      ...createProviderApiKeyAuthMethod({
        providerId: "google",
        envVarNames: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
        wizard: {
          choiceId: "studio-gemini-api-key",
          choiceLabel: "Google Gemini API key (creative intelligence)",
          choiceHint: "Powers brand analysis and creative reasoning",
          groupId: PLUGIN_ID,
          groupLabel: "Gods Eye Studio",
          groupHint: "Creative tools (image gen, video gen, brand intelligence)",
          onboardingScopes: ["image-generation"],
        },
      }),
    });

    // -- Initialize the Brain -----------------------------------------------

    // Brain is lazily initialized per session; this is the factory.
    let brainInstance: BrainMemory | undefined;
    function getBrain(config: Record<string, unknown>): BrainMemory {
      if (!brainInstance) {
        brainInstance = new BrainMemory(resolveBrainPath(config));
      }
      return brainInstance;
    }

    // -- Register creative tools -------------------------------------------

    api.registerTool(
      (ctx) => {
        const brain = getBrain(ctx.pluginConfig ?? {});
        return buildImageGenToolDef(brain);
      },
      { names: ["studio_image_generate"] },
    );

    api.registerTool(
      (ctx) => {
        const brain = getBrain(ctx.pluginConfig ?? {});
        return buildVideoGenToolDef(brain);
      },
      { names: ["studio_video_generate"] },
    );

    api.registerTool(
      () => buildBrandScanToolDef(),
      { names: ["studio_brand_scan"] },
    );

    api.registerTool(
      () => buildCalendarToolDef(),
      { names: ["studio_calendar"] },
    );

    api.registerTool(
      () => buildRecallToolDef(),
      { names: ["studio_recall"] },
    );

    // -- Inject creative context into every agent prompt --------------------

    api.registerMemoryPromptSection(({ availableTools }) => {
      // Only inject if at least one studio tool is available
      const studioTools = [
        "studio_image_generate",
        "studio_video_generate",
        "studio_brand_scan",
        "studio_calendar",
        "studio_recall",
      ];
      const hasStudioTool = studioTools.some((t) => availableTools.has(t));
      if (!hasStudioTool) return [];

      // Build and render creative context from the brain
      try {
        const brain = getBrain({});
        const ctx = buildCreativeContext(brain);
        return renderCreativeContextPrompt(ctx);
      } catch {
        // Brain not initialized yet — skip context injection
        return [];
      }
    });
  },
});
