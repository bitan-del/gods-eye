// Studio Calendar view — content calendar and scheduling.

import { html, nothing, type TemplateResult } from "lit";

export type StudioCalendarProps = {
  connected: boolean;
  loading: boolean;
  error: string | null;
  slots: StudioCalendarSlot[];
  newDate: string;
  newPlatform: string;
  newNotes: string;
  onNewDateChange: (value: string) => void;
  onNewPlatformChange: (value: string) => void;
  onNewNotesChange: (value: string) => void;
  onCreateSlot: () => void;
  onUpdateStatus: (slotId: string, status: string) => void;
  onRefresh: () => void;
};

export type StudioCalendarSlot = {
  id: string;
  date: string;
  platform?: string;
  status: "ideated" | "generated" | "approved" | "published";
  generationId?: string;
  notes?: string;
};

const PLATFORMS = ["instagram", "twitter", "linkedin", "facebook", "tiktok", "youtube", "other"];
const STATUS_COLORS: Record<string, string> = {
  ideated: "#6B7280",
  generated: "#3B82F6",
  approved: "#10B981",
  published: "#8B5CF6",
};

function renderStatusBadge(status: string): TemplateResult {
  const color = STATUS_COLORS[status] ?? "#6B7280";
  return html`
    <span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 0.75em; font-weight: 600; background: ${color}20; color: ${color}; text-transform: uppercase;">
      ${status}
    </span>
  `;
}

export function renderStudioCalendar(props: StudioCalendarProps): TemplateResult {
  // Group slots by date
  const grouped = new Map<string, StudioCalendarSlot[]>();
  for (const slot of props.slots) {
    const existing = grouped.get(slot.date) ?? [];
    existing.push(slot);
    grouped.set(slot.date, existing);
  }
  const sortedDates = [...grouped.keys()].toSorted();

  return html`
    <section class="card">
      <div class="card-title">Content Calendar</div>
      <div class="card-subtitle">Plan, generate, approve, and publish. Track content across platforms.</div>

      <div style="display: grid; gap: 16px; margin-top: 16px;">
        <!-- Add new slot -->
        <div style="padding: 16px; border-radius: 8px; background: var(--surface-2);">
          <div style="font-weight: 600; margin-bottom: 12px;">Schedule Content</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr 2fr; gap: 12px;">
            <div>
              <label class="field-label">Date</label>
              <input type="date" class="field-input" .value=${props.newDate}
                @input=${(e: Event) => props.onNewDateChange((e.target as HTMLInputElement).value)} />
            </div>
            <div>
              <label class="field-label">Platform</label>
              <select class="field-input" .value=${props.newPlatform}
                @change=${(e: Event) => props.onNewPlatformChange((e.target as HTMLSelectElement).value)}>
                <option value="">Select...</option>
                ${PLATFORMS.map((p) => html`<option value=${p}>${p}</option>`)}
              </select>
            </div>
            <div>
              <label class="field-label">Notes / Brief</label>
              <input type="text" class="field-input" placeholder="Hero image for campaign..."
                .value=${props.newNotes}
                @input=${(e: Event) => props.onNewNotesChange((e.target as HTMLInputElement).value)} />
            </div>
          </div>
          <button class="btn btn-primary" style="margin-top: 12px;"
            ?disabled=${!props.newDate || !props.connected}
            @click=${props.onCreateSlot}>
            Add to Calendar
          </button>
        </div>

        ${props.error ? html`<div class="error-message">${props.error}</div>` : nothing}

        <!-- Calendar slots -->
        ${
          sortedDates.length === 0
            ? html`
                <div style="opacity: 0.6; font-size: 0.9em">No upcoming content scheduled. Add a slot above.</div>
              `
            : sortedDates.map((date) => {
                const dateSlots = grouped.get(date) ?? [];
                const dateObj = new Date(date + "T00:00:00");
                const dayLabel = dateObj.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                });
                return html`
                <div style="margin-bottom: 8px;">
                  <div style="font-weight: 600; font-size: 0.9em; margin-bottom: 8px; opacity: 0.8;">${dayLabel}</div>
                  ${dateSlots.map(
                    (slot) => html`
                      <div style="padding: 12px; border-radius: 6px; background: var(--surface-2); margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                          ${renderStatusBadge(slot.status)}
                          ${slot.platform ? html`<span style="margin-left: 8px; font-size: 0.85em; opacity: 0.7;">${slot.platform}</span>` : nothing}
                          ${slot.notes ? html`<span style="margin-left: 8px; font-size: 0.85em;">${slot.notes}</span>` : nothing}
                        </div>
                        <select class="field-input" style="width: auto; font-size: 0.8em;"
                          .value=${slot.status}
                          @change=${(e: Event) => props.onUpdateStatus(slot.id, (e.target as HTMLSelectElement).value)}>
                          <option value="ideated">Ideated</option>
                          <option value="generated">Generated</option>
                          <option value="approved">Approved</option>
                          <option value="published">Published</option>
                        </select>
                      </div>
                    `,
                  )}
                </div>
              `;
              })
        }
      </div>
    </section>
  `;
}
