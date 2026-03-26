// Public API barrel for gods-eye-studio.
// Internal extension code imports from here; external code imports via
// godseye/plugin-sdk/gods-eye-studio (once registered).

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
