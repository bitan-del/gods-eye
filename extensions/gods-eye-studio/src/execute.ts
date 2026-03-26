// Execute — the glue between agent tool calls, providers, and the brain.
// When the agent calls studio_image_generate, this module:
// 1. Enriches the prompt with brand context
// 2. Routes to the correct provider (fal / gemini / openai)
// 3. Calls the provider API
// 4. Records the result in the brain's memory
// 5. Returns the result to the agent

import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BrainMemory } from "./brain/memory.js";
import { enrichPromptWithBrand, recordGeneration } from "./tools/image-gen.js";
import { recordVideoGeneration } from "./tools/video-gen.js";
import { saveBrandScanResult } from "./tools/brand-scan.js";
import { createCalendarSlot, updateCalendarSlot } from "./tools/content-calendar.js";
import { executeRecall } from "./tools/recall.js";
import { generateImageWithFal, generateVideoWithFal } from "./providers/fal.js";
import { analyzeBrandWithGemini, generateImageWithGemini } from "./providers/gemini.js";
import { generateImageWithOpenAI } from "./providers/openai-image.js";

// ---------------------------------------------------------------------------
// Provider routing
// ---------------------------------------------------------------------------

function resolveImageProvider(model?: string): "fal" | "openai" | "gemini" {
  const m = model?.toLowerCase() ?? "";
  if (m.startsWith("dall-e") || m.startsWith("gpt-image") || m.includes("openai")) return "openai";
  if (m.includes("gemini") || m.includes("imagen")) return "gemini";
  return "fal"; // default to fal
}

// ---------------------------------------------------------------------------
// Image Generation Execution
// ---------------------------------------------------------------------------

export async function executeImageGeneration(
  brain: BrainMemory,
  params: {
    prompt: string;
    model?: string;
    width?: number;
    height?: number;
    style?: string;
    negativePrompt?: string;
    tags?: string;
  },
  cfg?: Record<string, unknown>,
): Promise<{ id: string; model: string; prompt: string; imageCount: number; savedTo?: string }> {
  const prefs = brain.getPreferences();
  const model = params.model ?? prefs.defaultImageModel;
  const provider = resolveImageProvider(model);
  const tags = params.tags?.split(",").map((t) => t.trim()).filter(Boolean) ?? [];

  // Enrich prompt with brand context
  const enrichedPrompt = enrichPromptWithBrand(brain, {
    prompt: params.prompt,
    model,
    width: params.width,
    height: params.height,
    style: params.style,
    negativePrompt: params.negativePrompt,
    tags,
  });

  // Append style and negative prompt to the enriched prompt
  let finalPrompt = enrichedPrompt;
  if (params.style) {
    finalPrompt += `. Style: ${params.style}`;
  }
  if (params.negativePrompt) {
    finalPrompt += `. Avoid: ${params.negativePrompt}`;
  }

  const genId = randomUUID();
  let resultModel = model ?? "fal-ai/flux/dev";
  let imageRef: string | undefined;
  let revisedPrompt: string | undefined;
  let imageCount = 0;

  if (provider === "fal") {
    const result = await generateImageWithFal(
      { prompt: finalPrompt, model, width: params.width, height: params.height },
      cfg,
    );
    resultModel = result.model;
    revisedPrompt = result.revisedPrompt;
    imageCount = result.images.length;
    // Save first image to brain storage
    if (result.images[0]) {
      const imgPath = join(brain["basePath"], "generations", `${genId}.png`);
      writeFileSync(imgPath, result.images[0].buffer);
      imageRef = imgPath;
    }
  } else if (provider === "openai") {
    const result = await generateImageWithOpenAI(
      { prompt: finalPrompt, model, size: params.width && params.height ? `${params.width}x${params.height}` : undefined },
      cfg,
    );
    resultModel = result.model;
    revisedPrompt = result.revisedPrompt;
    imageCount = result.images.length;
    if (result.images[0]) {
      const imgPath = join(brain["basePath"], "generations", `${genId}.png`);
      writeFileSync(imgPath, result.images[0].buffer);
      imageRef = imgPath;
    }
  } else {
    const result = await generateImageWithGemini(finalPrompt, cfg, { model });
    resultModel = result.model;
    imageCount = result.images.length;
    if (result.images[0]) {
      const imgPath = join(brain["basePath"], "generations", `${genId}.png`);
      writeFileSync(imgPath, result.images[0].buffer);
      imageRef = imgPath;
    }
  }

  // Record in brain memory
  recordGeneration(
    brain,
    { prompt: params.prompt, model: resultModel, width: params.width, height: params.height, style: params.style, negativePrompt: params.negativePrompt, tags },
    { id: genId, imageRef: imageRef ?? "", prompt: finalPrompt, model: resultModel, revisedPrompt },
  );

  return {
    id: genId,
    model: resultModel,
    prompt: revisedPrompt ?? params.prompt,
    imageCount,
    savedTo: imageRef,
  };
}

// ---------------------------------------------------------------------------
// Video Generation Execution
// ---------------------------------------------------------------------------

export async function executeVideoGeneration(
  brain: BrainMemory,
  params: {
    prompt: string;
    model?: string;
    duration?: number;
    aspectRatio?: string;
    tags?: string;
  },
  cfg?: Record<string, unknown>,
): Promise<{ id: string; model: string; videoUrl: string }> {
  const prefs = brain.getPreferences();
  const model = params.model ?? prefs.defaultVideoModel;
  const tags = params.tags?.split(",").map((t) => t.trim()).filter(Boolean) ?? [];

  // Enrich prompt with brand context
  const enrichedPrompt = enrichPromptWithBrand(brain, {
    prompt: params.prompt,
    model,
    tags,
  });

  const result = await generateVideoWithFal(
    { prompt: enrichedPrompt, model, duration: params.duration, aspectRatio: params.aspectRatio },
    cfg,
  );

  const genId = randomUUID();
  recordVideoGeneration(
    brain,
    { prompt: params.prompt, model: result.model, duration: params.duration, tags },
    { id: genId, videoRef: result.videoUrl, prompt: enrichedPrompt, model: result.model },
  );

  return { id: genId, model: result.model, videoUrl: result.videoUrl };
}

// ---------------------------------------------------------------------------
// Brand Scan Execution
// ---------------------------------------------------------------------------

export async function executeBrandScan(
  brain: BrainMemory,
  params: { source: string; name: string; setAsDefault?: boolean },
  cfg?: Record<string, unknown>,
): Promise<{ brandId: string; brand: ReturnType<typeof saveBrandScanResult> }> {
  const analysis = await analyzeBrandWithGemini(params.source, cfg);

  const brand = saveBrandScanResult(brain, params, {
    colors: analysis.colors,
    fonts: analysis.fonts,
    tone: analysis.tone,
    visualStyle: analysis.visualStyle,
  });

  return { brandId: brand.id, brand };
}

// ---------------------------------------------------------------------------
// Calendar Execution
// ---------------------------------------------------------------------------

export function executeCalendar(
  brain: BrainMemory,
  params: {
    action: string;
    date?: string;
    platform?: string;
    status?: string;
    slotId?: string;
    generationId?: string;
    notes?: string;
  },
): unknown {
  switch (params.action) {
    case "create":
      if (!params.date) throw new Error("date is required to create a calendar slot");
      return createCalendarSlot(brain, {
        date: params.date,
        platform: params.platform,
        notes: params.notes,
      });
    case "update":
      if (!params.slotId) throw new Error("slotId is required to update a calendar slot");
      return updateCalendarSlot(brain, params.slotId, {
        status: params.status as "ideated" | "generated" | "approved" | "published" | undefined,
        generationId: params.generationId,
        notes: params.notes,
        platform: params.platform,
      });
    case "list":
      return brain.upcomingSlots(30);
    case "upcoming":
      return brain.upcomingSlots(7);
    default:
      throw new Error(`Unknown calendar action: ${params.action}`);
  }
}

// ---------------------------------------------------------------------------
// Recall Execution
// ---------------------------------------------------------------------------

export function executeStudioRecall(
  brain: BrainMemory,
  params: { query: string; type?: string; limit?: number },
) {
  return executeRecall(brain, params);
}
