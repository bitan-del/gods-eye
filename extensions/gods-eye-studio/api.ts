// Public API barrel for gods-eye-studio.
// Internal extension code imports from here; external code imports via
// godseye/plugin-sdk/gods-eye-studio (once registered).

// Brain
export type {
  BrainMemory,
  BrandProfile,
  CalendarSlot,
  CharacterProfile,
  GenerationRecord,
  UserPreferences,
} from "./src/brain/memory.js";

export { buildCreativeContext, renderCreativeContextPrompt } from "./src/brain/context-builder.js";
export type { CreativeContext } from "./src/brain/context-builder.js";

export { recallFromMemory, findSimilarGenerations } from "./src/brain/recall.js";
export type { RecallResult } from "./src/brain/recall.js";

// Providers
export { generateImageWithFal, generateVideoWithFal } from "./src/providers/fal.js";
export type { FalImageRequest, FalImageResult, FalVideoRequest, FalVideoResult } from "./src/providers/fal.js";

export { analyzeBrandWithGemini, generateImageWithGemini, reasonWithGemini } from "./src/providers/gemini.js";
export type { GeminiBrandAnalysis, GeminiCreativeResponse, GeminiImageResult } from "./src/providers/gemini.js";

export { generateImageWithOpenAI } from "./src/providers/openai-image.js";
export type { OpenAIImageRequest, OpenAIImageResult } from "./src/providers/openai-image.js";

// Execution (high-level, brain-aware)
export {
  executeImageGeneration,
  executeVideoGeneration,
  executeBrandScan,
  executeCalendar,
  executeStudioRecall,
} from "./src/execute.js";
