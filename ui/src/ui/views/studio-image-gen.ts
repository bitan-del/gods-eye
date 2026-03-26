// Studio Image Generation view — generate images with brand context.

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
  lastResult: StudioImageGenResult | null;
  recentGenerations: StudioImageGenResult[];
  activeBrand: { name: string; colors: { primary: string; secondary: string } } | null;
  onPromptChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onWidthChange: (value: number) => void;
  onHeightChange: (value: number) => void;
  onStyleChange: (value: string) => void;
  onGenerate: () => void;
};

export type StudioImageGenResult = {
  id: string;
  model: string;
  prompt: string;
  imageCount: number;
  savedTo?: string;
  createdAt: string;
};

const IMAGE_MODELS = [
  { value: "fal-ai/flux/dev", label: "Flux Dev (fal.ai)" },
  { value: "fal-ai/flux/schnell", label: "Flux Schnell (fal.ai)" },
  { value: "fal-ai/flux-pro/v1.1", label: "Flux Pro 1.1 (fal.ai)" },
  { value: "gpt-image-1", label: "GPT Image (OpenAI)" },
  { value: "dall-e-3", label: "DALL-E 3 (OpenAI)" },
  { value: "gemini-3.1-flash-image-preview", label: "Imagen (Google)" },
];

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

export function renderStudioImageGen(props: StudioImageGenProps): TemplateResult {
  const brandBanner = props.activeBrand
    ? html`
        <div class="studio-brand-banner" style="border-left: 4px solid ${props.activeBrand.colors.primary}; padding: 8px 12px; margin-bottom: 16px; border-radius: 4px; background: var(--surface-2);">
          <strong>Active brand:</strong> ${props.activeBrand.name}
          <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: ${props.activeBrand.colors.primary}; margin-left: 8px;"></span>
          <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: ${props.activeBrand.colors.secondary}; margin-left: 4px;"></span>
          <span style="opacity: 0.7; margin-left: 8px; font-size: 0.85em;">Brand context auto-applied to prompts</span>
        </div>
      `
    : nothing;

  return html`
    <section class="card">
      <div class="card-title">Image Generation</div>
      <div class="card-subtitle">Generate brand-aware images. Results saved to creative memory.</div>

      ${brandBanner}

      <div style="display: grid; gap: 16px; margin-top: 16px;">
        <!-- Prompt -->
        <div>
          <label class="field-label">Prompt</label>
          <textarea
            class="field-input"
            rows="3"
            placeholder="A hero banner for the landing page..."
            .value=${props.prompt}
            @input=${(e: Event) => props.onPromptChange((e.target as HTMLTextAreaElement).value)}
          ></textarea>
        </div>

        <!-- Model + Style row -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div>
            <label class="field-label">Model</label>
            <select class="field-input" .value=${props.model} @change=${(e: Event) => props.onModelChange((e.target as HTMLSelectElement).value)}>
              ${IMAGE_MODELS.map(
                (m) => html`<option value=${m.value} ?selected=${m.value === props.model}>${m.label}</option>`,
              )}
            </select>
          </div>
          <div>
            <label class="field-label">Style</label>
            <select class="field-input" .value=${props.style} @change=${(e: Event) => props.onStyleChange((e.target as HTMLSelectElement).value)}>
              <option value="">Auto</option>
              ${STYLE_PRESETS.map(
                (s) => html`<option value=${s} ?selected=${s === props.style}>${s}</option>`,
              )}
            </select>
          </div>
        </div>

        <!-- Size row -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div>
            <label class="field-label">Width</label>
            <input type="number" class="field-input" .value=${String(props.width)} min="256" max="4096" step="64"
              @input=${(e: Event) => props.onWidthChange(Number((e.target as HTMLInputElement).value))} />
          </div>
          <div>
            <label class="field-label">Height</label>
            <input type="number" class="field-input" .value=${String(props.height)} min="256" max="4096" step="64"
              @input=${(e: Event) => props.onHeightChange(Number((e.target as HTMLInputElement).value))} />
          </div>
        </div>

        <!-- Generate button -->
        <button
          class="btn btn-primary"
          ?disabled=${props.generating || !props.prompt.trim() || !props.connected}
          @click=${props.onGenerate}
        >
          ${props.generating ? "Generating..." : "Generate Image"}
        </button>

        ${props.error ? html`<div class="error-message">${props.error}</div>` : nothing}

        <!-- Last result -->
        ${props.lastResult
          ? html`
              <div class="studio-result" style="margin-top: 16px; padding: 12px; border-radius: 8px; background: var(--surface-2);">
                <div style="font-weight: 600; margin-bottom: 8px;">Generated</div>
                <div style="font-size: 0.9em; opacity: 0.8;">
                  Model: ${props.lastResult.model} | Images: ${props.lastResult.imageCount}
                  ${props.lastResult.savedTo ? html` | Saved to brain memory` : nothing}
                </div>
                <div style="font-size: 0.85em; opacity: 0.6; margin-top: 4px;">
                  Prompt: "${props.lastResult.prompt}"
                </div>
              </div>
            `
          : nothing}

        <!-- Recent generations -->
        ${props.recentGenerations.length > 0
          ? html`
              <div style="margin-top: 24px;">
                <div style="font-weight: 600; margin-bottom: 12px;">Recent Generations</div>
                ${props.recentGenerations.map(
                  (gen) => html`
                    <div style="padding: 8px 12px; border-radius: 6px; background: var(--surface-2); margin-bottom: 8px;">
                      <div style="font-size: 0.9em;">${gen.prompt}</div>
                      <div style="font-size: 0.8em; opacity: 0.6;">${gen.model} | ${gen.createdAt}</div>
                    </div>
                  `,
                )}
              </div>
            `
          : nothing}
      </div>
    </section>
  `;
}
