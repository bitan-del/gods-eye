// Studio Video Generation view — create videos with brand awareness.

import { html, nothing, type TemplateResult } from "lit";

export type StudioVideoGenProps = {
  connected: boolean;
  loading: boolean;
  generating: boolean;
  error: string | null;
  prompt: string;
  model: string;
  duration: number;
  aspectRatio: string;
  lastResult: { id: string; model: string; videoUrl: string } | null;
  activeBrand: { name: string } | null;
  onPromptChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onDurationChange: (value: number) => void;
  onAspectRatioChange: (value: string) => void;
  onGenerate: () => void;
};

const VIDEO_MODELS = [
  { value: "fal-ai/minimax/video-01-live", label: "Minimax Video 01 Live (fal.ai)" },
  { value: "fal-ai/minimax/video-01", label: "Minimax Video 01 (fal.ai)" },
  { value: "fal-ai/kling-video/v1/standard/text-to-video", label: "Kling v1 Standard (fal.ai)" },
  { value: "fal-ai/hunyuan-video", label: "HunYuan Video (fal.ai)" },
];

const ASPECT_RATIOS = ["16:9", "9:16", "1:1", "4:3", "3:4"];

export function renderStudioVideoGen(props: StudioVideoGenProps): TemplateResult {
  return html`
    <section class="card">
      <div class="card-title">Video Generation</div>
      <div class="card-subtitle">Create brand-aware videos. Uses fal.ai queue for async generation.</div>

      ${
        props.activeBrand
          ? html`<div style="padding: 8px 12px; margin-bottom: 16px; border-radius: 4px; background: var(--surface-2); font-size: 0.9em;">
            Active brand: <strong>${props.activeBrand.name}</strong> (auto-applied)
          </div>`
          : nothing
      }

      <div style="display: grid; gap: 16px; margin-top: 16px;">
        <div>
          <label class="field-label">Prompt</label>
          <textarea class="field-input" rows="3" placeholder="A product showcase video with smooth camera movement..."
            .value=${props.prompt}
            @input=${(e: Event) => props.onPromptChange((e.target as HTMLTextAreaElement).value)}
          ></textarea>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
          <div>
            <label class="field-label">Model</label>
            <select class="field-input" .value=${props.model} @change=${(e: Event) => props.onModelChange((e.target as HTMLSelectElement).value)}>
              ${VIDEO_MODELS.map(
                (m) =>
                  html`<option value=${m.value} ?selected=${m.value === props.model}>${m.label}</option>`,
              )}
            </select>
          </div>
          <div>
            <label class="field-label">Duration (seconds)</label>
            <input type="number" class="field-input" .value=${String(props.duration)} min="1" max="30"
              @input=${(e: Event) => props.onDurationChange(Number((e.target as HTMLInputElement).value))} />
          </div>
          <div>
            <label class="field-label">Aspect Ratio</label>
            <select class="field-input" .value=${props.aspectRatio} @change=${(e: Event) => props.onAspectRatioChange((e.target as HTMLSelectElement).value)}>
              ${ASPECT_RATIOS.map(
                (ar) =>
                  html`<option value=${ar} ?selected=${ar === props.aspectRatio}>${ar}</option>`,
              )}
            </select>
          </div>
        </div>

        <button class="btn btn-primary" ?disabled=${props.generating || !props.prompt.trim() || !props.connected} @click=${props.onGenerate}>
          ${props.generating ? "Generating (this may take a few minutes)..." : "Generate Video"}
        </button>

        ${props.error ? html`<div class="error-message">${props.error}</div>` : nothing}

        ${
          props.lastResult
            ? html`
              <div style="margin-top: 16px; padding: 12px; border-radius: 8px; background: var(--surface-2);">
                <div style="font-weight: 600;">Video Generated</div>
                <div style="font-size: 0.9em; opacity: 0.8; margin-top: 4px;">
                  Model: ${props.lastResult.model}
                </div>
                <div style="margin-top: 8px;">
                  <a href=${props.lastResult.videoUrl} target="_blank" rel="noopener" class="btn btn-secondary">
                    Download Video
                  </a>
                </div>
              </div>
            `
            : nothing
        }
      </div>
    </section>
  `;
}
