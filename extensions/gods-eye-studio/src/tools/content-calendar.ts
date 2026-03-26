// Content Calendar tool — manage upcoming content slots.
// Integrates with the brain to track what's planned, generated, and published.

import { randomUUID } from "node:crypto";
import type { BrainMemory, CalendarSlot } from "../brain/memory.js";

export function buildCalendarToolDef() {
  return {
    name: "studio_calendar",
    description: [
      "Manage the content calendar. Create, update, or list upcoming content slots.",
      "Each slot tracks status (ideated → generated → approved → published).",
      "Link generated images/videos to calendar slots for end-to-end tracking.",
    ].join(" "),
    parameters: {
      type: "object" as const,
      properties: {
        action: {
          type: "string" as const,
          description: 'Action: "create", "update", "list", or "upcoming".',
        },
        date: {
          type: "string" as const,
          description: "Date for the slot (YYYY-MM-DD).",
        },
        platform: {
          type: "string" as const,
          description: "Target platform (e.g. instagram, twitter, linkedin).",
        },
        status: {
          type: "string" as const,
          description: 'Slot status: "ideated", "generated", "approved", or "published".',
        },
        slotId: {
          type: "string" as const,
          description: "Slot ID (for update action).",
        },
        generationId: {
          type: "string" as const,
          description: "Link a generation to this slot.",
        },
        notes: {
          type: "string" as const,
          description: "Notes or brief for this slot.",
        },
      },
      required: ["action"] as const,
    },
  };
}

export function createCalendarSlot(
  brain: BrainMemory,
  params: { date: string; platform?: string; notes?: string },
): CalendarSlot {
  const slot: CalendarSlot = {
    id: randomUUID(),
    date: params.date,
    platform: params.platform,
    status: "ideated",
    notes: params.notes,
  };
  brain.saveCalendarSlot(slot);
  return slot;
}

export function updateCalendarSlot(
  brain: BrainMemory,
  slotId: string,
  updates: Partial<Pick<CalendarSlot, "status" | "generationId" | "notes" | "platform">>,
): CalendarSlot | undefined {
  const existing = brain.getCalendarSlot(slotId);
  if (!existing) return undefined;
  const updated = { ...existing, ...updates };
  brain.saveCalendarSlot(updated);
  return updated;
}
