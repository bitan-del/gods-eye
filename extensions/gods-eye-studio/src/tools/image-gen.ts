// Image Generation tool — brand-aware, memory-aware image creation.
// Automatically applies active brand guidelines and stores every generation
// in the brain's memory for future recall.

import { randomUUID } from "node:crypto";
import type { BrainMemory } from "../brain/memory.js";

export interface ImageGenInput {
  prompt: string;
  model?: string;
  width?: number;
  height?: number;
  style?: string;
  negativePrompt?: string;
  /** Override the active brand for this generation. */
  brandId?: string;
  tags?: string[];
}

export interface ImageGenResult {
  id: string;
  /** Base64-encoded image or URL depending on provider. */
  imageRef: string;
  prompt: string;
  model: string;
  revisedPrompt?: string;
}

/**
 * Build the image generation tool definition for the agent.
 * The tool automatically enriches prompts with brand context
 * and persists results to the brain.
 */
export function buildImageGenToolDef(brain: BrainMemory) {
  return {
    name: "studio_image_generate",
    description: [
      "Generate an image using the Gods Eye Studio.",
      "Automatically applies active brand guidelines (colors, tone, style).",
      "Results are saved to creative memory for future reference.",
      'Use "studio_recall" to reference past generations.',
    ].join(" "),
    parameters: {
      type: "object" as const,
      properties: {
        prompt: {
          type: "string" as const,
          description: "The image generation prompt. Brand context is injected automatically.",
        },
        model: {
          type: "string" as const,
          description:
            "Model to use (e.g. fal-ai/flux/dev, dall-e-3). Defaults to user preference.",
        },
        width: { type: "number" as const, description: "Image width in pixels." },
        height: { type: "number" as const, description: "Image height in pixels." },
        style: {
          type: "string" as const,
          description: "Style override (e.g. photorealistic, illustration, 3d-render).",
        },
        negativePrompt: {
          type: "string" as const,
          description: "What to avoid in the generation.",
        },
        tags: {
          type: "string" as const,
          description: "Comma-separated tags for organizing in memory.",
        },
      },
      required: ["prompt"] as const,
    },
  };
}

/**
 * Enrich a prompt with active brand context from the brain.
 */
export function enrichPromptWithBrand(brain: BrainMemory, input: ImageGenInput): string {
  const prefs = brain.getPreferences();
  const brandId = input.brandId ?? prefs.defaultBrandId;
  if (!brandId) return input.prompt;

  const brand = brain.getBrand(brandId);
  if (!brand) return input.prompt;

  const brandSuffix = [
    `Brand colors: ${brand.colors.primary}, ${brand.colors.secondary}`,
    brand.tone ? `Tone: ${brand.tone}` : null,
    brand.visualStyle ? `Style: ${brand.visualStyle}` : null,
  ]
    .filter(Boolean)
    .join(". ");

  return `${input.prompt}. ${brandSuffix}`;
}

/**
 * Record a completed generation in the brain's memory.
 */
export function recordGeneration(
  brain: BrainMemory,
  input: ImageGenInput,
  result: ImageGenResult,
): void {
  brain.saveGeneration({
    id: result.id,
    type: "image",
    prompt: result.revisedPrompt ?? input.prompt,
    model: result.model,
    provider: resolveProviderFromModel(result.model),
    settings: {
      width: input.width,
      height: input.height,
      style: input.style,
      negativePrompt: input.negativePrompt,
    },
    resultRef: result.imageRef,
    brandId: input.brandId ?? brain.getPreferences().defaultBrandId,
    tags: input.tags ?? [],
    createdAt: new Date().toISOString(),
  });
}

function resolveProviderFromModel(model: string): string {
  if (model.startsWith("fal-ai/") || model.startsWith("fal/")) return "fal";
  if (model.startsWith("dall-e") || model.startsWith("gpt-image")) return "openai";
  if (model.includes("imagen") || model.includes("gemini")) return "google";
  return "unknown";
}
