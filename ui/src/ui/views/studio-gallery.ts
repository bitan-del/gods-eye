// Studio Gallery view — browse all generated assets with full context.

import { html, nothing, type TemplateResult } from "lit";

export type StudioGalleryProps = {
  connected: boolean;
  loading: boolean;
  error: string | null;
  generations: StudioGalleryItem[];
  filterType: "all" | "image" | "video" | "text";
  searchQuery: string;
  onFilterChange: (type: "all" | "image" | "video" | "text") => void;
  onSearchChange: (query: string) => void;
  onRefresh: () => void;
};

export type StudioGalleryItem = {
  id: string;
  type: "image" | "video" | "text";
  prompt: string;
  model: string;
  provider: string;
  brandName?: string;
  tags: string[];
  createdAt: string;
  resultRef?: string;
};

const TYPE_ICONS: Record<string, string> = {
  image: "\u{1F5BC}",
  video: "\u{1F3AC}",
  text: "\u{1F4DD}",
};

function renderGalleryCard(item: StudioGalleryItem): TemplateResult {
  return html`
    <div style="padding: 16px; border-radius: 8px; background: var(--surface-2); display: flex; flex-direction: column; gap: 8px;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 1.2em;">${TYPE_ICONS[item.type] ?? ""}</span>
        <span style="font-size: 0.75em; opacity: 0.6;">
          ${new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      <!-- Prompt -->
      <div style="font-size: 0.9em; line-height: 1.4;">
        ${item.prompt.length > 120 ? `${item.prompt.slice(0, 120)}...` : item.prompt}
      </div>

      <!-- Metadata -->
      <div style="font-size: 0.8em; opacity: 0.6; display: flex; flex-wrap: wrap; gap: 4px;">
        <span>${item.model}</span>
        ${item.brandName ? html`<span>| ${item.brandName}</span>` : nothing}
      </div>

      <!-- Tags -->
      ${item.tags.length > 0
        ? html`
            <div style="display: flex; flex-wrap: wrap; gap: 4px;">
              ${item.tags.map(
                (tag) => html`
                  <span style="display: inline-block; padding: 1px 6px; border-radius: 8px; font-size: 0.7em; background: var(--surface-3); opacity: 0.8;">
                    ${tag}
                  </span>
                `,
              )}
            </div>
          `
        : nothing}
    </div>
  `;
}

export function renderStudioGallery(props: StudioGalleryProps): TemplateResult {
  const filteredGenerations = props.generations.filter((item) => {
    if (props.filterType !== "all" && item.type !== props.filterType) return false;
    if (props.searchQuery.trim()) {
      const q = props.searchQuery.toLowerCase();
      return (
        item.prompt.toLowerCase().includes(q) ||
        item.model.toLowerCase().includes(q) ||
        item.tags.some((t) => t.toLowerCase().includes(q)) ||
        (item.brandName?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  return html`
    <section class="card">
      <div class="card-title">Gallery</div>
      <div class="card-subtitle">Browse all generated assets with full creative context.</div>

      <div style="display: grid; gap: 16px; margin-top: 16px;">
        <!-- Filters -->
        <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
          <div style="display: flex; gap: 4px;">
            ${(["all", "image", "video", "text"] as const).map(
              (type) => html`
                <button
                  class="btn ${props.filterType === type ? "btn-primary" : "btn-secondary"} btn-sm"
                  @click=${() => props.onFilterChange(type)}
                >
                  ${type === "all" ? "All" : `${TYPE_ICONS[type] ?? ""} ${type}`}
                </button>
              `,
            )}
          </div>
          <input type="text" class="field-input" style="flex: 1; min-width: 200px;"
            placeholder="Search prompts, models, tags..."
            .value=${props.searchQuery}
            @input=${(e: Event) => props.onSearchChange((e.target as HTMLInputElement).value)} />
          <button class="btn btn-secondary btn-sm" @click=${props.onRefresh}>Refresh</button>
        </div>

        ${props.error ? html`<div class="error-message">${props.error}</div>` : nothing}

        <!-- Gallery grid -->
        ${filteredGenerations.length === 0
          ? html`<div style="opacity: 0.6; font-size: 0.9em; text-align: center; padding: 32px;">
              ${props.generations.length === 0
                ? "No generations yet. Use Image Gen or Video Gen to create your first asset."
                : "No results match your filter."}
            </div>`
          : html`
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px;">
                ${filteredGenerations.map(renderGalleryCard)}
              </div>
            `}

        <div style="font-size: 0.8em; opacity: 0.5; text-align: center;">
          ${filteredGenerations.length} of ${props.generations.length} items
        </div>
      </div>
    </section>
  `;
}
