// Studio Image Generation view — canvas-style UI with aspect ratio picker,
// model bar, and prompt input. Mirrors Gods Eye Online design.

import { html, nothing, type TemplateResult } from "lit";

export type StudioImageGenProps = {
  connected: boolean;
  loading: boolean;
  generating: boolean;
  error: string | null;
  prompt: string;
  model: string;
  width: number;
  height: number;
  style: string;
  aspectRatio: string;
  resolution: string;
  batchCount: number;
  lastResult: StudioImageGenResult | null;
  recentGenerations: StudioImageGenResult[];
  activeBrand: { name: string; colors: { primary: string; secondary: string } } | null;
  onPromptChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onWidthChange: (value: number) => void;
  onHeightChange: (value: number) => void;
  onStyleChange: (value: string) => void;
  onAspectRatioChange: (value: string) => void;
  onResolutionChange: (value: string) => void;
  onBatchCountChange: (value: number) => void;
  onGenerate: () => void;
};

export type StudioImageGenResult = {
  id: string;
  model: string;
  prompt: string;
  imageCount: number;
  savedTo?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  createdAt: string;
};

const IMAGE_MODELS = [
  { value: "fal-ai/flux/dev", label: "Flux Dev", provider: "fal.ai" },
  { value: "fal-ai/flux/schnell", label: "Flux Schnell", provider: "fal.ai" },
  { value: "fal-ai/flux-pro/v1.1", label: "Flux Pro 1.1", provider: "fal.ai" },
  { value: "gpt-image-1", label: "GPT Image", provider: "OpenAI" },
  { value: "dall-e-3", label: "DALL-E 3", provider: "OpenAI" },
  { value: "gemini-3.1-flash-image-preview", label: "Gemini 3.1 Flash", provider: "Google" },
];

const ASPECT_RATIOS = [
  { value: "1:1", label: "Square (1:1)", icon: "square" },
  { value: "16:9", label: "Landscape (16:9)", icon: "landscape" },
  { value: "9:16", label: "Portrait (9:16)", icon: "portrait" },
  { value: "4:3", label: "Classic Landscape (4:3)", icon: "landscape" },
  { value: "3:4", label: "Classic Portrait (3:4)", icon: "portrait" },
  { value: "21:9", label: "Cinematic (21:9)", icon: "cinematic" },
  { value: "9:21", label: "Social High (9:21)", icon: "portrait" },
  { value: "3:2", label: "Wide (3:2)", icon: "landscape" },
  { value: "2:3", label: "Tall (2:3)", icon: "portrait" },
  { value: "4:5", label: "Social Post (4:5)", icon: "portrait" },
];

const RESOLUTIONS = ["512", "1K", "2K", "4K"];

const STYLE_PRESETS = [
  "photorealistic",
  "illustration",
  "3d-render",
  "watercolor",
  "oil-painting",
  "flat-design",
  "cyberpunk",
  "minimalist",
  "retro",
  "anime",
];

function getAspectIcon(icon: string): string {
  switch (icon) {
    case "square":
      return "\u25A1";
    case "landscape":
      return "\u25AD";
    case "portrait":
      return "\u25AF";
    case "cinematic":
      return "\u25AD";
    default:
      return "\u25A1";
  }
}

function getModelDisplay(model: string): string {
  const m = IMAGE_MODELS.find((x) => x.value === model);
  return m ? m.label : model;
}

export function renderStudioImageGen(props: StudioImageGenProps): TemplateResult {
  const currentModel = IMAGE_MODELS.find((m) => m.value === props.model) ?? IMAGE_MODELS[0];

  return html`
    <style>
      .studio-canvas-container {
        display: flex;
        flex-direction: column;
        height: calc(100vh - 80px);
        background: var(--bg-primary, #fafafa);
        position: relative;
      }
      .studio-canvas-area {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        position: relative;
        overflow: hidden;
      }
      .studio-empty-state {
        text-align: center;
        color: var(--text-secondary, #888);
      }
      .studio-empty-state h2 {
        font-size: 1.5rem;
        font-weight: 600;
        color: var(--text-primary, #222);
        margin-bottom: 8px;
      }
      .studio-empty-state p {
        font-size: 0.95rem;
        opacity: 0.7;
      }
      .studio-sync-btn {
        position: absolute;
        top: 12px;
        right: 16px;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 16px;
        background: var(--surface-1, #fff);
        border: 1px solid var(--border, #e0e0e0);
        border-radius: 8px;
        font-size: 0.85rem;
        cursor: pointer;
        font-weight: 500;
        color: var(--text-primary, #222);
      }
      .studio-sync-btn:hover {
        background: var(--surface-2, #f5f5f5);
      }
      .studio-bottom-bar {
        border-top: 1px solid var(--border, #e0e0e0);
        background: var(--surface-1, #fff);
        padding: 12px 20px;
      }
      .studio-prompt-row {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 10px;
      }
      .studio-prompt-input {
        flex: 1;
        padding: 12px 16px;
        border: 1px solid var(--border, #e0e0e0);
        border-radius: 12px;
        font-size: 0.95rem;
        background: var(--surface-2, #f5f5f5);
        color: var(--text-primary, #222);
        outline: none;
        resize: none;
        font-family: inherit;
      }
      .studio-prompt-input:focus {
        border-color: var(--accent, #3b82f6);
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
      }
      .studio-prompt-input::placeholder {
        color: var(--text-tertiary, #aaa);
      }
      .studio-prompt-icons {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .studio-prompt-icon-btn {
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        background: transparent;
        cursor: pointer;
        border-radius: 8px;
        color: var(--text-secondary, #888);
        font-size: 1.1rem;
      }
      .studio-prompt-icon-btn:hover {
        background: var(--surface-2, #f5f5f5);
        color: var(--text-primary, #222);
      }
      .studio-generate-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 24px;
        background: var(--accent, #3b82f6);
        color: white;
        border: none;
        border-radius: 12px;
        font-size: 0.95rem;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.15s;
      }
      .studio-generate-btn:hover:not(:disabled) {
        opacity: 0.9;
      }
      .studio-generate-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .studio-generate-btn .sparkle {
        font-size: 1rem;
      }
      .studio-toolbar {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }
      .studio-toolbar-chip {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 6px 12px;
        border-radius: 8px;
        border: 1px solid var(--border, #e0e0e0);
        background: var(--surface-1, #fff);
        font-size: 0.82rem;
        cursor: pointer;
        color: var(--text-primary, #222);
        position: relative;
        user-select: none;
      }
      .studio-toolbar-chip:hover {
        background: var(--surface-2, #f5f5f5);
      }
      .studio-toolbar-chip.active {
        border-color: var(--accent, #3b82f6);
        color: var(--accent, #3b82f6);
        background: rgba(59, 130, 246, 0.05);
      }
      .studio-toolbar-chip .chip-icon {
        font-size: 0.9rem;
      }
      .studio-toolbar-chip .chip-arrow {
        font-size: 0.7rem;
        opacity: 0.5;
        margin-left: 2px;
      }
      .studio-toolbar-spacer {
        flex: 1;
      }
      .studio-batch-control {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .studio-batch-btn {
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--border, #e0e0e0);
        border-radius: 6px;
        background: var(--surface-1, #fff);
        cursor: pointer;
        font-size: 0.85rem;
        color: var(--text-primary, #222);
      }
      .studio-batch-btn:hover {
        background: var(--surface-2, #f5f5f5);
      }
      .studio-batch-count {
        font-size: 0.85rem;
        min-width: 20px;
        text-align: center;
        font-weight: 500;
      }
      /* Aspect ratio dropdown */
      .studio-ar-dropdown {
        position: absolute;
        bottom: calc(100% + 8px);
        left: 0;
        background: var(--surface-elevated, #1a1a1a);
        border-radius: 12px;
        padding: 12px;
        min-width: 240px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        z-index: 100;
        color: var(--text-on-dark, #fff);
      }
      .studio-ar-dropdown-title {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        opacity: 0.6;
        margin-bottom: 8px;
        padding: 0 4px;
      }
      .studio-ar-option {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 10px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 0.9rem;
        transition: background 0.1s;
      }
      .studio-ar-option:hover {
        background: rgba(255, 255, 255, 0.1);
      }
      .studio-ar-option.selected {
        background: rgba(255, 255, 255, 0.15);
      }
      .studio-ar-option .ar-icon {
        font-size: 1.1rem;
        opacity: 0.8;
      }
      .studio-ar-option .ar-check {
        margin-left: auto;
        font-size: 0.9rem;
        color: var(--accent, #3b82f6);
      }
      /* Model dropdown */
      .studio-model-dropdown {
        position: absolute;
        bottom: calc(100% + 8px);
        left: 0;
        background: var(--surface-elevated, #1a1a1a);
        border-radius: 12px;
        padding: 12px;
        min-width: 260px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        z-index: 100;
        color: var(--text-on-dark, #fff);
      }
      .studio-model-option {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 10px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 0.9rem;
      }
      .studio-model-option:hover {
        background: rgba(255, 255, 255, 0.1);
      }
      .studio-model-option.selected {
        background: rgba(255, 255, 255, 0.15);
      }
      .studio-model-option .model-provider {
        font-size: 0.75rem;
        opacity: 0.5;
      }
      /* Preview thumbnail */
      .studio-preview-thumb {
        position: absolute;
        bottom: 16px;
        right: 16px;
        width: 120px;
        border-radius: 8px;
        overflow: hidden;
        border: 2px solid var(--border, #e0e0e0);
        background: var(--surface-1, #fff);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }
      .studio-preview-thumb img {
        width: 100%;
        display: block;
      }
      .studio-preview-thumb .thumb-label {
        font-size: 0.7rem;
        text-align: center;
        padding: 4px;
        opacity: 0.7;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      /* Result display */
      .studio-result-display {
        max-width: 80%;
        max-height: 70%;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
      }
      .studio-result-display img {
        max-width: 100%;
        max-height: 60vh;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
      }
      .studio-result-meta {
        font-size: 0.85rem;
        color: var(--text-secondary, #888);
        text-align: center;
      }
      /* Generating state */
      .studio-generating-overlay {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
      }
      .studio-generating-spinner {
        width: 48px;
        height: 48px;
        border: 3px solid var(--border, #e0e0e0);
        border-top-color: var(--accent, #3b82f6);
        border-radius: 50%;
        animation: studio-spin 0.8s linear infinite;
      }
      @keyframes studio-spin {
        to { transform: rotate(360deg); }
      }
      /* Brand banner */
      .studio-brand-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        background: var(--surface-2, #f5f5f5);
        border-radius: 8px;
        font-size: 0.82rem;
      }
      .studio-brand-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        display: inline-block;
      }
      /* Error */
      .studio-error-banner {
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444;
        padding: 8px 16px;
        border-radius: 8px;
        font-size: 0.85rem;
        margin: 8px 20px 0;
      }
      /* Recent generations sidebar strip */
      .studio-recent-strip {
        display: flex;
        gap: 8px;
        padding: 8px 0;
        overflow-x: auto;
      }
      .studio-recent-card {
        flex-shrink: 0;
        width: 80px;
        height: 80px;
        border-radius: 8px;
        background: var(--surface-2, #f0f0f0);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.7rem;
        text-align: center;
        padding: 4px;
        cursor: pointer;
        border: 1px solid var(--border, #e0e0e0);
        color: var(--text-secondary, #888);
        overflow: hidden;
      }
      .studio-recent-card img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .studio-recent-card:hover {
        border-color: var(--accent, #3b82f6);
      }
    </style>

    <div class="studio-canvas-container">
      <!-- Canvas area -->
      <div class="studio-canvas-area">
        ${
          props.generating
            ? html`
              <div class="studio-generating-overlay">
                <div class="studio-generating-spinner"></div>
                <div style="font-size: 0.95rem; color: var(--text-secondary, #888);">
                  Generating with ${getModelDisplay(props.model)}...
                </div>
              </div>
            `
            : props.lastResult?.imageUrl
              ? html`
                <div class="studio-result-display">
                  <img src=${props.lastResult.imageUrl} alt=${props.lastResult.prompt} />
                  <div class="studio-result-meta">
                    ${props.lastResult.prompt} &mdash; ${getModelDisplay(props.lastResult.model)}
                  </div>
                </div>
              `
              : html`
                  <div class="studio-empty-state">
                    <h2>Your canvas is empty</h2>
                    <p>Enter a prompt below to start creating</p>
                  </div>
                `
        }

        <!-- Sync folder button -->
        <button class="studio-sync-btn">
          <span>&#128193;</span> Sync Folder
        </button>

        <!-- Active brand indicator -->
        ${
          props.activeBrand
            ? html`
              <div style="position: absolute; top: 12px; left: 16px;">
                <div class="studio-brand-bar">
                  <span class="studio-brand-dot" style="background: ${props.activeBrand.colors.primary};"></span>
                  <span>${props.activeBrand.name}</span>
                </div>
              </div>
            `
            : nothing
        }

        <!-- Last result thumbnail preview -->
        ${
          props.lastResult?.thumbnailUrl && !props.generating
            ? html`
              <div class="studio-preview-thumb">
                <img src=${props.lastResult.thumbnailUrl} alt="Preview" />
                <div class="thumb-label">${getModelDisplay(props.lastResult.model)}</div>
              </div>
            `
            : nothing
        }
      </div>

      ${props.error ? html`<div class="studio-error-banner">${props.error}</div>` : nothing}

      <!-- Recent generations strip -->
      ${
        props.recentGenerations.length > 0
          ? html`
            <div style="padding: 0 20px;">
              <div class="studio-recent-strip">
                ${props.recentGenerations.map(
                  (gen) => html`
                    <div class="studio-recent-card" title=${gen.prompt}>
                      ${
                        gen.imageUrl
                          ? html`<img src=${gen.imageUrl} alt=${gen.prompt} />`
                          : html`<span>${gen.prompt.slice(0, 30)}</span>`
                      }
                    </div>
                  `,
                )}
              </div>
            </div>
          `
          : nothing
      }

      <!-- Bottom bar -->
      <div class="studio-bottom-bar">
        <!-- Prompt row -->
        <div class="studio-prompt-row">
          <button class="studio-prompt-icon-btn" title="Upload reference">+</button>
          <input
            class="studio-prompt-input"
            type="text"
            placeholder="Imagine something extraordinary..."
            .value=${props.prompt}
            @input=${(e: Event) => props.onPromptChange((e.target as HTMLInputElement).value)}
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === "Enter" && !e.shiftKey && props.prompt.trim()) {
                e.preventDefault();
                props.onGenerate();
              }
            }}
          />
          <div class="studio-prompt-icons">
            <button class="studio-prompt-icon-btn" title="Bookmarks">&#128278;</button>
            <button class="studio-prompt-icon-btn" title="Settings">&#9881;</button>
          </div>
          <button
            class="studio-generate-btn"
            ?disabled=${props.generating || !props.prompt.trim() || !props.connected}
            @click=${props.onGenerate}
          >
            <span class="sparkle">&#10024;</span>
            ${props.generating ? "GENERATING..." : "GENERATE"}
          </button>
        </div>

        <!-- Toolbar chips -->
        <div class="studio-toolbar">
          <!-- Model selector chip -->
          <div class="studio-toolbar-chip" style="position: relative;"
            @click=${(e: Event) => {
              const el = (e.currentTarget as HTMLElement).querySelector(
                ".studio-model-dropdown",
              ) as HTMLElement;
              if (el) el.style.display = el.style.display === "block" ? "none" : "block";
            }}
          >
            <span class="chip-icon">&#9889;</span>
            <span>${currentModel.label}</span>
            <span class="chip-arrow">&#9656;</span>
            <div class="studio-model-dropdown" style="display: none;" @click=${(e: Event) => e.stopPropagation()}>
              ${IMAGE_MODELS.map(
                (m) => html`
                  <div class="studio-model-option ${m.value === props.model ? "selected" : ""}"
                    @click=${() => {
                      props.onModelChange(m.value);
                      const dropdown = document.querySelector(
                        ".studio-model-dropdown",
                      ) as HTMLElement;
                      if (dropdown) dropdown.style.display = "none";
                    }}
                  >
                    <span>${m.label}</span>
                    <span class="model-provider">${m.provider}</span>
                  </div>
                `,
              )}
            </div>
          </div>

          <!-- Aspect ratio chip -->
          <div class="studio-toolbar-chip active" style="position: relative;"
            @click=${(e: Event) => {
              const el = (e.currentTarget as HTMLElement).querySelector(
                ".studio-ar-dropdown",
              ) as HTMLElement;
              if (el) el.style.display = el.style.display === "block" ? "none" : "block";
            }}
          >
            <span class="chip-icon">${getAspectIcon(ASPECT_RATIOS.find((a) => a.value === props.aspectRatio)?.icon ?? "square")}</span>
            <span>${props.aspectRatio}</span>
            <div class="studio-ar-dropdown" style="display: none;" @click=${(e: Event) => e.stopPropagation()}>
              <div class="studio-ar-dropdown-title">ASPECT RATIO</div>
              ${ASPECT_RATIOS.map(
                (ar) => html`
                  <div class="studio-ar-option ${ar.value === props.aspectRatio ? "selected" : ""}"
                    @click=${() => {
                      props.onAspectRatioChange(ar.value);
                      const dropdown = document.querySelector(".studio-ar-dropdown") as HTMLElement;
                      if (dropdown) dropdown.style.display = "none";
                    }}
                  >
                    <span class="ar-icon">${getAspectIcon(ar.icon)}</span>
                    <span>${ar.label}</span>
                    ${
                      ar.value === props.aspectRatio
                        ? html`
                            <span class="ar-check">&#10003;</span>
                          `
                        : nothing
                    }
                  </div>
                `,
              )}
            </div>
          </div>

          <!-- Resolution chip -->
          <div class="studio-toolbar-chip"
            @click=${() => {
              const idx = RESOLUTIONS.indexOf(props.resolution);
              const next = RESOLUTIONS[(idx + 1) % RESOLUTIONS.length];
              props.onResolutionChange(next);
            }}
          >
            <span class="chip-icon">&#127760;</span>
            <span>${props.resolution}</span>
          </div>

          <!-- Camera Angle placeholder -->
          <div class="studio-toolbar-chip">
            <span class="chip-icon">&#128247;</span>
            <span>Camera Angle</span>
          </div>

          <!-- Rotate Object placeholder -->
          <div class="studio-toolbar-chip">
            <span class="chip-icon">&#8635;</span>
            <span>Rotate Object</span>
          </div>

          <!-- Style/Prompts chip -->
          <div class="studio-toolbar-chip" style="position: relative;"
            @click=${(e: Event) => {
              const el = (e.currentTarget as HTMLElement).querySelector(
                ".studio-model-dropdown",
              ) as HTMLElement;
              if (el) el.style.display = el.style.display === "block" ? "none" : "block";
            }}
          >
            <span class="chip-icon">&#128221;</span>
            <span>${props.style || "Prompts"}</span>
            <div class="studio-model-dropdown" style="display: none;" @click=${(e: Event) => e.stopPropagation()}>
              <div style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.6; margin-bottom: 8px; padding: 0 4px;">STYLE PRESET</div>
              <div class="studio-model-option ${!props.style ? "selected" : ""}" @click=${() => props.onStyleChange("")}>
                <span>Auto</span>
              </div>
              ${STYLE_PRESETS.map(
                (s) => html`
                  <div class="studio-model-option ${s === props.style ? "selected" : ""}"
                    @click=${() => props.onStyleChange(s)}
                  >
                    <span>${s}</span>
                  </div>
                `,
              )}
            </div>
          </div>

          <!-- Brand chip -->
          <div class="studio-toolbar-chip">
            <span class="chip-icon">&#10024;</span>
            <span>${props.activeBrand?.name ?? "No Brand"}</span>
          </div>

          <div class="studio-toolbar-spacer"></div>

          <!-- Batch count -->
          <div class="studio-batch-control">
            <button class="studio-batch-btn" @click=${() => props.onBatchCountChange(Math.max(1, props.batchCount - 1))}>-</button>
            <span class="studio-batch-count">${props.batchCount}</span>
            <button class="studio-batch-btn" @click=${() => props.onBatchCountChange(Math.min(4, props.batchCount + 1))}>+</button>
          </div>
        </div>
      </div>
    </div>
  `;
}
