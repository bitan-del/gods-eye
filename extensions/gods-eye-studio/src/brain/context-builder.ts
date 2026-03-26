// Context Builder — assembles relevant creative context for every LLM call.
// Runs before the model sees any user message, injecting brand state,
// recent generation history, calendar, and character references.

import type {
  BrainMemory,
  BrandProfile,
  CalendarSlot,
  CharacterProfile,
  GenerationRecord,
} from "./memory.js";

export interface CreativeContext {
  activeBrand?: BrandProfile;
  recentGenerations: GenerationRecord[];
  upcomingCalendar: CalendarSlot[];
  characters: CharacterProfile[];
}

/**
 * Build the creative context block that gets injected into every agent prompt.
 * This is the key differentiator: the LLM always knows your brand, history,
 * calendar, and characters without explicit tool calls.
 */
export function buildCreativeContext(brain: BrainMemory): CreativeContext {
  const prefs = brain.getPreferences();
  const activeBrand = prefs.defaultBrandId ? brain.getBrand(prefs.defaultBrandId) : undefined;
  const recentGenerations = brain.recentGenerations(5);
  const upcomingCalendar = brain.upcomingSlots(7);
  const characters = brain.listCharacters();

  return {
    activeBrand,
    recentGenerations,
    upcomingCalendar,
    characters,
  };
}

/**
 * Render creative context as a system prompt section.
 * This gets prepended to the LLM system prompt so the brain
 * "always knows" the creative state.
 */
export function renderCreativeContextPrompt(ctx: CreativeContext): string[] {
  const lines: string[] = ["## Gods Eye Studio — Creative Context"];

  // Active brand
  if (ctx.activeBrand) {
    const b = ctx.activeBrand;
    lines.push("");
    lines.push(`### Active Brand: ${b.name}`);
    lines.push(`- Primary color: ${b.colors.primary}`);
    lines.push(`- Secondary color: ${b.colors.secondary}`);
    if (b.colors.accent) lines.push(`- Accent color: ${b.colors.accent}`);
    if (b.tone) lines.push(`- Tone: ${b.tone}`);
    if (b.visualStyle) lines.push(`- Visual style: ${b.visualStyle}`);
    if (b.fonts?.heading) lines.push(`- Heading font: ${b.fonts.heading}`);
    if (b.fonts?.body) lines.push(`- Body font: ${b.fonts.body}`);
    lines.push(
      "All image/video generations should respect these brand guidelines unless explicitly overridden.",
    );
  }

  // Recent generation history
  if (ctx.recentGenerations.length > 0) {
    lines.push("");
    lines.push("### Recent Generations");
    for (const gen of ctx.recentGenerations) {
      const dateLabel = new Date(gen.createdAt).toLocaleDateString();
      const tags = gen.tags.length > 0 ? ` [${gen.tags.join(", ")}]` : "";
      lines.push(`- ${dateLabel} | ${gen.type} | ${gen.model}: "${gen.prompt}"${tags}`);
    }
  }

  // Upcoming calendar slots
  if (ctx.upcomingCalendar.length > 0) {
    lines.push("");
    lines.push("### Upcoming Content Calendar");
    for (const slot of ctx.upcomingCalendar) {
      const platform = slot.platform ? ` (${slot.platform})` : "";
      lines.push(`- ${slot.date}${platform}: ${slot.status}${slot.notes ? ` — ${slot.notes}` : ""}`);
    }
  }

  // Character profiles
  if (ctx.characters.length > 0) {
    lines.push("");
    lines.push("### Known Characters");
    for (const char of ctx.characters) {
      const desc = char.description ? `: ${char.description}` : "";
      const style = char.style ? ` (style: ${char.style})` : "";
      lines.push(`- ${char.name}${desc}${style}`);
    }
  }

  lines.push("");
  return lines;
}
