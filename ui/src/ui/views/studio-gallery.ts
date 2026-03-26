// Studio Gallery view — browse all generated assets with full context,
// preview modal, side-by-side comparison, download, and regenerate.

import { html, nothing, type TemplateResult } from "lit";

export type StudioGalleryProps = {
  connected: boolean;
  loading: boolean;
  error: string | null;
  generations: StudioGalleryItem[];
  filterType: "all" | "image" | "video" | "text";
  searchQuery: string;
  /** Currently previewed item (modal open when non-null). */
  previewItem: StudioGalleryItem | null;
  /** Items selected for side-by-side A/B comparison (max 2). */
  compareItems: StudioGalleryItem[];
  /** Sub-view state: "gallery" | "spaces" | "editor" */
  subView: "gallery" | "spaces" | "editor";
  onFilterChange: (type: "all" | "image" | "video" | "text") => void;
  onSearchChange: (query: string) => void;
  onRefresh: () => void;
  onPreview: (item: StudioGalleryItem | null) => void;
  onToggleCompare: (item: StudioGalleryItem) => void;
  onClearCompare: () => void;
  onDownload: (item: StudioGalleryItem) => void;
  onRegenerate: (item: StudioGalleryItem) => void;
  onOpenSpaces: () => void;
  onOpenEditor: () => void;
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
  /** Optional thumbnail / full URL for image assets. */
  thumbnailUrl?: string;
  fullUrl?: string;
};

const TYPE_ICONS: Record<string, string> = {
  image: "\uD83D\uDDBC\uFE0F",
  video: "\uD83C\uDFAC",
  text: "\uD83D\uDCDD",
};

// --- Gallery card with action buttons ---

function renderGalleryCard(
  item: StudioGalleryItem,
  compareItems: StudioGalleryItem[],
  onPreview: (item: StudioGalleryItem) => void,
  onToggleCompare: (item: StudioGalleryItem) => void,
  onDownload: (item: StudioGalleryItem) => void,
  onRegenerate: (item: StudioGalleryItem) => void,
): TemplateResult {
  const isComparing = compareItems.some((c) => c.id === item.id);

  return html`
    <div style="padding: 16px; border-radius: 8px; background: var(--surface-2); display: flex; flex-direction: column; gap: 8px; cursor: pointer; transition: box-shadow 0.2s; border: ${isComparing ? "2px solid #f59e0b" : "2px solid transparent"};"
      @click=${() => onPreview(item)}>

      <!-- Thumbnail placeholder -->
      ${
        item.thumbnailUrl
          ? html`<div style="width: 100%; aspect-ratio: 16/9; border-radius: 6px; overflow: hidden; background: var(--surface-1);">
            <img src=${item.thumbnailUrl} alt="Thumbnail" style="width: 100%; height: 100%; object-fit: cover;" />
          </div>`
          : html`<div style="width: 100%; aspect-ratio: 16/9; border-radius: 6px; background: var(--surface-1); display: flex; align-items: center; justify-content: center; font-size: 2em; opacity: 0.3;">
            ${TYPE_ICONS[item.type] ?? ""}
          </div>`
      }

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
      ${
        item.tags.length > 0
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
          : nothing
      }

      <!-- Action buttons -->
      <div style="display: flex; gap: 4px; margin-top: 4px;" @click=${(e: Event) => e.stopPropagation()}>
        <button class="btn btn-secondary btn-sm" style="font-size: 0.75em;"
          @click=${() => onDownload(item)} title="Download">Download</button>
        <button class="btn btn-secondary btn-sm" style="font-size: 0.75em;"
          @click=${() => onRegenerate(item)} title="Regenerate with same prompt">Regenerate</button>
        <button class="btn ${isComparing ? "btn-primary" : "btn-secondary"} btn-sm" style="font-size: 0.75em;"
          @click=${() => onToggleCompare(item)}
          title="Add to A/B comparison">${isComparing ? "Comparing" : "Compare"}</button>
      </div>
    </div>
  `;
}

// --- Preview modal ---

function renderPreviewModal(
  item: StudioGalleryItem,
  onClose: () => void,
  onDownload: (item: StudioGalleryItem) => void,
  onRegenerate: (item: StudioGalleryItem) => void,
): TemplateResult {
  return html`
    <div
      style="
        position: fixed; inset: 0; z-index: 1000;
        background: rgba(0, 0, 0, 0.8);
        display: flex; align-items: center; justify-content: center;
        padding: 24px;
      "
      @click=${onClose}
    >
      <div
        style="
          max-width: 720px; width: 100%;
          background: var(--surface-2);
          border-radius: 12px;
          padding: 24px;
          max-height: 90vh;
          overflow-y: auto;
        "
        @click=${(e: Event) => e.stopPropagation()}
      >
        <!-- Close button -->
        <div style="display: flex; justify-content: flex-end;">
          <button class="btn btn-secondary btn-sm" @click=${onClose}>Close</button>
        </div>

        <!-- Image preview -->
        ${
          item.fullUrl || item.thumbnailUrl
            ? html`<div style="width: 100%; border-radius: 8px; overflow: hidden; margin: 12px 0; background: var(--surface-1);">
              <img src=${item.fullUrl ?? item.thumbnailUrl ?? ""} alt="Preview" style="width: 100%; display: block;" />
            </div>`
            : html`<div style="width: 100%; aspect-ratio: 16/9; border-radius: 8px; background: var(--surface-1); display: flex; align-items: center; justify-content: center; margin: 12px 0; font-size: 3em; opacity: 0.3;">
              ${TYPE_ICONS[item.type] ?? ""}
            </div>`
        }

        <!-- Details -->
        <div style="display: grid; gap: 8px; margin-top: 12px;">
          <div style="font-weight: 600; font-size: 1em;">${TYPE_ICONS[item.type] ?? ""} ${item.type} Generation</div>
          <div style="font-size: 0.9em; line-height: 1.5;">${item.prompt}</div>
          <div style="font-size: 0.85em; opacity: 0.6;">
            Model: ${item.model} | Provider: ${item.provider}
            ${item.brandName ? html` | Brand: ${item.brandName}` : nothing}
          </div>
          <div style="font-size: 0.8em; opacity: 0.5;">
            Created: ${new Date(item.createdAt).toLocaleString("en-US")}
            ${item.resultRef ? html` | Ref: ${item.resultRef}` : nothing}
          </div>
          ${
            item.tags.length > 0
              ? html`<div style="display: flex; flex-wrap: wrap; gap: 4px;">
                ${item.tags.map(
                  (tag) =>
                    html`<span style="display: inline-block; padding: 2px 8px; border-radius: 8px; font-size: 0.75em; background: var(--surface-3);">${tag}</span>`,
                )}
              </div>`
              : nothing
          }
        </div>

        <!-- Actions -->
        <div style="display: flex; gap: 8px; margin-top: 16px;">
          <button class="btn btn-secondary btn-sm" @click=${() => onDownload(item)}>Download</button>
          <button class="btn btn-primary btn-sm" @click=${() => onRegenerate(item)}>Regenerate</button>
        </div>
      </div>
    </div>
  `;
}

// --- Side-by-side comparison ---

function renderComparisonView(items: StudioGalleryItem[], onClear: () => void): TemplateResult {
  if (items.length < 2) {
    return html``;
  }

  const [a, b] = items;
  return html`
    <div style="margin-top: 16px; padding: 16px; border-radius: 8px; background: var(--surface-2); border: 2px solid #f59e0b;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <div style="font-weight: 600;">A/B Comparison</div>
        <button class="btn btn-secondary btn-sm" @click=${onClear}>Clear Comparison</button>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        ${[a, b].map(
          (item) => html`
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${
                item.thumbnailUrl
                  ? html`<div style="width: 100%; aspect-ratio: 16/9; border-radius: 6px; overflow: hidden; background: var(--surface-1);">
                    <img src=${item.thumbnailUrl} alt="Compare" style="width: 100%; height: 100%; object-fit: cover;" />
                  </div>`
                  : html`<div style="width: 100%; aspect-ratio: 16/9; border-radius: 6px; background: var(--surface-1); display: flex; align-items: center; justify-content: center; font-size: 2em; opacity: 0.3;">
                    ${TYPE_ICONS[item.type] ?? ""}
                  </div>`
              }
              <div style="font-size: 0.85em; line-height: 1.4;">
                ${item.prompt.length > 100 ? `${item.prompt.slice(0, 100)}...` : item.prompt}
              </div>
              <div style="font-size: 0.8em; opacity: 0.6;">${item.model}</div>
            </div>
          `,
        )}
      </div>
    </div>
  `;
}

// --- Main render ---

export function renderStudioGallery(props: StudioGalleryProps): TemplateResult {
  const filteredGenerations = props.generations.filter((item) => {
    if (props.filterType !== "all" && item.type !== props.filterType) {
      return false;
    }
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
        <!-- Toolbar: filters + sub-view buttons -->
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

          <!-- Sub-view navigation -->
          <span style="width: 1px; height: 24px; background: var(--border-1, #333);"></span>
          <button class="btn btn-secondary btn-sm" @click=${props.onOpenSpaces} title="Open Spaces workflow builder">Spaces</button>
          <button class="btn btn-secondary btn-sm" @click=${props.onOpenEditor} title="Open image markup editor">Editor</button>
        </div>

        ${props.error ? html`<div class="error-message">${props.error}</div>` : nothing}

        <!-- A/B Comparison view (shown when 2 items selected) -->
        ${
          props.compareItems.length >= 2
            ? renderComparisonView(props.compareItems, props.onClearCompare)
            : props.compareItems.length === 1
              ? html`
                  <div
                    style="
                      font-size: 0.85em;
                      opacity: 0.6;
                      padding: 8px 12px;
                      border-radius: 6px;
                      background: var(--surface-2);
                      border: 1px dashed #f59e0b;
                    "
                  >
                    1 item selected for comparison. Select one more to compare side-by-side.
                  </div>
                `
              : nothing
        }

        <!-- Gallery grid -->
        ${
          filteredGenerations.length === 0
            ? html`<div style="opacity: 0.6; font-size: 0.9em; text-align: center; padding: 32px;">
              ${
                props.generations.length === 0
                  ? "No generations yet. Use Image Gen or Video Gen to create your first asset."
                  : "No results match your filter."
              }
            </div>`
            : html`
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px;">
                ${filteredGenerations.map((item) =>
                  renderGalleryCard(
                    item,
                    props.compareItems,
                    (it) => props.onPreview(it),
                    (it) => props.onToggleCompare(it),
                    (it) => props.onDownload(it),
                    (it) => props.onRegenerate(it),
                  ),
                )}
              </div>
            `
        }

        <div style="font-size: 0.8em; opacity: 0.5; text-align: center;">
          ${filteredGenerations.length} of ${props.generations.length} items
        </div>
      </div>

      <!-- Preview modal -->
      ${
        props.previewItem
          ? renderPreviewModal(
              props.previewItem,
              () => props.onPreview(null),
              (it) => props.onDownload(it),
              (it) => props.onRegenerate(it),
            )
          : nothing
      }
    </section>
  `;
}
