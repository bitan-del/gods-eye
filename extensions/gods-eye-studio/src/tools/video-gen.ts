// Video Generation tool — brand-aware, memory-aware video creation.

import type { BrainMemory } from "../brain/memory.js";

export interface VideoGenInput {
  prompt: string;
  model?: string;
  duration?: number;
  aspectRatio?: string;
  tags?: string[];
}

export interface VideoGenResult {
  id: string;
  videoRef: string;
  prompt: string;
  model: string;
}

export function buildVideoGenToolDef(brain: BrainMemory) {
  return {
    name: "studio_video_generate",
    description: [
      "Generate a video using the Gods Eye Studio.",
      "Automatically applies active brand guidelines.",
      "Results are saved to creative memory.",
    ].join(" "),
    parameters: {
      type: "object" as const,
      properties: {
        prompt: {
          type: "string" as const,
          description: "The video generation prompt. Brand context is injected automatically.",
        },
        model: {
          type: "string" as const,
          description: "Model to use (e.g. fal-ai/minimax/video-01-live). Defaults to user preference.",
        },
        duration: {
          type: "number" as const,
          description: "Video duration in seconds.",
        },
        aspectRatio: {
          type: "string" as const,
          description: 'Aspect ratio (e.g. "16:9", "9:16", "1:1").',
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

export function recordVideoGeneration(
  brain: BrainMemory,
  input: VideoGenInput,
  result: VideoGenResult,
): void {
  brain.saveGeneration({
    id: result.id,
    type: "video",
    prompt: result.prompt,
    model: result.model,
    provider: result.model.startsWith("fal") ? "fal" : "unknown",
    settings: {
      duration: input.duration,
      aspectRatio: input.aspectRatio,
    },
    resultRef: result.videoRef,
    brandId: brain.getPreferences().defaultBrandId,
    tags: input.tags ?? [],
    createdAt: new Date().toISOString(),
  });
}
