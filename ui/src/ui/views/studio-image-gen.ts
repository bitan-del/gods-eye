// Studio Image Generation view — exact replica of Gods Eye Online ControlBar + Canvas.
// Dark/light mode via CSS custom properties matching the original theme system.

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

// --- Models exactly matching Gods Eye Online ---
const IMAGE_MODELS = [
  {
    value: "gemini-3.1-flash",
    label: "Gemini 3.1 Flash",
    desc: "Google's Newest Model. Pro quality at Flash speed.",
    badge: "NEW",
    premium: false,
    hasQuality: true,
    maxBatch: 4,
  },
  {
    value: "gemini-3.0-pro",
    label: "Gemini 3.0 Pro",
    desc: "Google's Flagship Generation Model",
    badge: "Pro",
    premium: true,
    hasQuality: true,
    maxBatch: 4,
  },
  {
    value: "fal-ai/seedream-4.5",
    label: "Seedream 4.5",
    desc: "ByteDance's newest model. Up to 4K output.",
    badge: "NEW",
    premium: false,
    hasQuality: false,
    maxBatch: 4,
  },
  {
    value: "gpt-image-1.5",
    label: "GPT Image 1.5",
    desc: "OpenAI's latest image model. High-fidelity.",
    badge: "NEW",
    premium: true,
    hasQuality: false,
    maxBatch: 4,
  },
  {
    value: "gpt-image-1",
    label: "GPT Image 1",
    desc: "OpenAI GPT Image 1 via fal.ai.",
    badge: "OpenAI",
    premium: true,
    hasQuality: false,
    maxBatch: 4,
  },
  {
    value: "fal-ai/flux-2-ultra",
    label: "FLUX.2 Ultra",
    desc: "Black Forest Labs. State-of-the-art photorealism.",
    badge: "BFL",
    premium: true,
    hasQuality: false,
    maxBatch: 4,
  },
  {
    value: "fal-ai/reve-1",
    label: "Reve Image 1.0",
    desc: "High-fidelity with outstanding color accuracy.",
    badge: "Reve",
    premium: false,
    hasQuality: false,
    maxBatch: 4,
  },
  {
    value: "fal-ai/flux/dev",
    label: "Flux Dev",
    desc: "Fast development model from fal.ai.",
    badge: "Fast",
    premium: false,
    hasQuality: false,
    maxBatch: 4,
  },
  {
    value: "dall-e-3",
    label: "DALL-E 3",
    desc: "OpenAI DALL-E 3 image generation.",
    badge: "OpenAI",
    premium: true,
    hasQuality: false,
    maxBatch: 1,
  },
];

const ASPECT_RATIOS = [
  { value: "1:1", label: "Square (1:1)", icon: "square" },
  { value: "16:9", label: "Landscape (16:9)", icon: "monitor" },
  { value: "9:16", label: "Portrait (9:16)", icon: "phone" },
  { value: "4:3", label: "Classic Landscape (4:3)", icon: "rect-h" },
  { value: "3:4", label: "Classic Portrait (3:4)", icon: "rect-v" },
  { value: "21:9", label: "Cinematic (21:9)", icon: "monitor" },
  { value: "9:21", label: "Social High (9:21)", icon: "phone" },
  { value: "3:2", label: "Wide (3:2)", icon: "rect-h" },
  { value: "2:3", label: "Tall (2:3)", icon: "rect-v" },
  { value: "4:5", label: "Social Post (4:5)", icon: "rect-v" },
];

const CAMERA_ANGLES = [
  { label: "Eye Level", icon: "\uD83D\uDC41\uFE0F", value: "eye-level" },
  { label: "Low Angle", icon: "\u2B07\uFE0F", value: "low-angle" },
  { label: "Bird's Eye", icon: "\uD83E\uDD85", value: "birds-eye" },
  { label: "Dutch Tilt", icon: "\u2197\uFE0F", value: "dutch-tilt" },
  { label: "Worm's Eye", icon: "\uD83E\uDEB1", value: "worms-eye" },
  { label: "Overhead", icon: "\u2B06\uFE0F", value: "overhead" },
];

const OBJECT_ROTATIONS = [
  { label: "Rotate Left", icon: "\u21BA", value: "rotate-left" },
  { label: "Rotate Right", icon: "\u21BB", value: "rotate-right" },
  { label: "Tilt Up", icon: "\u2191", value: "tilt-up" },
  { label: "Tilt Down", icon: "\u2193", value: "tilt-down" },
  { label: "Lean Left", icon: "\u2196", value: "lean-left" },
  { label: "Lean Right", icon: "\u2198", value: "lean-right" },
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

function arIcon(icon: string): TemplateResult {
  switch (icon) {
    case "monitor":
      return html`
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      `;
    case "phone":
      return html`
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="5" y="2" width="14" height="20" rx="2" />
        </svg>
      `;
    case "rect-h":
      return html`
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="5" width="20" height="14" rx="2" />
        </svg>
      `;
    case "rect-v":
      return html`
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="5" y="2" width="14" height="20" rx="2" />
        </svg>
      `;
    default:
      return html`
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
      `;
  }
}

export function renderStudioImageGen(props: StudioImageGenProps): TemplateResult {
  const currentModel = IMAGE_MODELS.find((m) => m.value === props.model) ?? IMAGE_MODELS[0];

  return html`
    <style>
      /* ── Gods Eye Online Theme System ── */
      .ge-studio {
        --ge-bg: #ffffff;
        --ge-surface: #f4f4f5;
        --ge-panel: #ffffff;
        --ge-border: #e4e4e7;
        --ge-brand: #000000;
        --ge-brand-hover: #333333;
        --ge-text-1: #000000;
        --ge-text-2: #52525b;
        --ge-dot: #e4e4e7;
      }
      @media (prefers-color-scheme: dark) {
        .ge-studio {
          --ge-bg: #030303;
          --ge-surface: #0f0f0f;
          --ge-panel: #141414;
          --ge-border: #27272a;
          --ge-brand: #CCFF00;
          --ge-brand-hover: #B2DF00;
          --ge-text-1: #ffffff;
          --ge-text-2: #a1a1aa;
          --ge-dot: #1a1a1a;
        }
      }
      /* Also respect .dark class on root */
      :root.dark .ge-studio,
      .dark .ge-studio {
        --ge-bg: #030303;
        --ge-surface: #0f0f0f;
        --ge-panel: #141414;
        --ge-border: #27272a;
        --ge-brand: #CCFF00;
        --ge-brand-hover: #B2DF00;
        --ge-text-1: #ffffff;
        --ge-text-2: #a1a1aa;
        --ge-dot: #1a1a1a;
      }
      .ge-studio {
        display: flex;
        flex-direction: column;
        height: calc(100vh - 60px);
        background-color: var(--ge-bg);
        background-image: radial-gradient(var(--ge-dot) 1px, transparent 1px);
        background-size: 24px 24px;
        color: var(--ge-text-1);
        font-family: 'Inter', -apple-system, sans-serif;
        position: relative;
        -webkit-font-smoothing: antialiased;
      }
      /* Grain overlay */
      .ge-studio::before {
        content: "";
        position: absolute;
        inset: 0;
        opacity: 0.025;
        pointer-events: none;
        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        z-index: 1;
        mix-blend-mode: overlay;
      }
      .ge-canvas { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; z-index: 2; }
      .ge-empty h2 { font-size: 1.5rem; font-weight: 600; color: var(--ge-text-1); margin: 0 0 8px; }
      .ge-empty p { font-size: 0.95rem; color: var(--ge-text-2); margin: 0; }
      .ge-sync { position: absolute; top: 12px; right: 16px; display: flex; align-items: center; gap: 6px; padding: 8px 16px; background: var(--ge-panel); border: 1px solid var(--ge-border); border-radius: 12px; font-size: 0.82rem; font-weight: 600; cursor: pointer; color: var(--ge-text-1); z-index: 3; }
      .ge-sync:hover { border-color: var(--ge-brand); }

      /* ── Control Bar (bottom) ── */
      .ge-bar-wrap { position: relative; z-index: 40; padding: 0 16px 16px; display: flex; justify-content: center; }
      .ge-bar { position: relative; width: 100%; max-width: 900px; background: color-mix(in srgb, var(--ge-panel) 80%, transparent); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border: 1px solid color-mix(in srgb, var(--ge-text-1) 5%, transparent); border-radius: 28px; padding: 6px; box-shadow: 0 20px 40px -10px rgba(0,0,0,0.3); }
      .ge-bar-inner { display: flex; flex-direction: column; gap: 6px; }

      /* Top row: prompt + generate */
      .ge-top-row { display: flex; align-items: center; gap: 10px; padding: 4px 6px 0; }
      .ge-add-btn { width: 40px; height: 40px; border-radius: 50%; background: var(--ge-surface); border: 1px solid var(--ge-border); display: flex; align-items: center; justify-content: center; color: var(--ge-text-2); cursor: pointer; flex-shrink: 0; font-size: 1.2rem; }
      .ge-add-btn:hover { border-color: var(--ge-brand); color: var(--ge-text-1); }
      .ge-prompt { flex: 1; background: transparent; border: none; outline: none; color: var(--ge-text-1); font-size: 0.9rem; font-weight: 500; padding: 8px 4px; resize: none; height: 48px; font-family: inherit; line-height: 1.6; }
      .ge-prompt::placeholder { color: color-mix(in srgb, var(--ge-text-2) 50%, transparent); }
      .ge-icon-btn { width: 40px; height: 48px; display: flex; align-items: center; justify-content: center; background: none; border: none; color: var(--ge-text-2); cursor: pointer; border-radius: 12px; font-size: 1.1rem; flex-shrink: 0; }
      .ge-icon-btn:hover { background: var(--ge-surface); color: var(--ge-text-1); }
      .ge-icon-btn.active { color: var(--ge-brand); }
      .ge-gen-wrap { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; }
      .ge-gen-btn { display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 20px; background: var(--ge-brand); color: var(--ge-bg); border: none; border-radius: 12px; font-size: 0.7rem; font-weight: 800; cursor: pointer; letter-spacing: 0.08em; text-transform: uppercase; transition: opacity 0.15s, transform 0.15s; }
      .ge-gen-btn:hover:not(:disabled) { transform: scale(1.05); }
      .ge-gen-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
      .ge-gen-btn .sparkle { font-size: 0.9rem; }
      .ge-gen-label { font-size: 0.55rem; color: var(--ge-text-2); font-family: monospace; text-transform: uppercase; opacity: 0.5; padding-right: 4px; }

      /* Chip row */
      .ge-chips { display: flex; align-items: center; gap: 8px; background: color-mix(in srgb, var(--ge-surface) 50%, transparent); border-radius: 24px; padding: 6px; overflow-x: auto; }
      .ge-chips::-webkit-scrollbar { display: none; }
      .ge-chip { height: 36px; padding: 0 12px 0 4px; border-radius: 999px; background: var(--ge-panel); border: 1px solid var(--ge-border); display: flex; align-items: center; gap: 8px; cursor: pointer; white-space: nowrap; color: var(--ge-text-1); font-size: 0.78rem; font-weight: 700; letter-spacing: -0.01em; transition: border-color 0.15s; position: relative; }
      .ge-chip:hover { border-color: color-mix(in srgb, var(--ge-brand) 50%, transparent); }
      .ge-chip-icon { width: 28px; height: 28px; border-radius: 50%; background: var(--ge-surface); display: flex; align-items: center; justify-content: center; color: var(--ge-brand); transition: background 0.15s, color 0.15s; font-size: 0.85rem; }
      .ge-chip:hover .ge-chip-icon { background: var(--ge-brand); color: var(--ge-bg); }
      .ge-chip-arrow { font-size: 0.65rem; color: var(--ge-text-2); margin-left: 2px; }
      .ge-chip-plain { height: 32px; padding: 0 12px; border-radius: 8px; background: transparent; border: 1px solid transparent; display: flex; align-items: center; gap: 6px; cursor: pointer; white-space: nowrap; color: var(--ge-text-2); font-size: 0.78rem; font-weight: 500; transition: all 0.15s; }
      .ge-chip-plain:hover { background: color-mix(in srgb, var(--ge-text-1) 5%, transparent); color: var(--ge-text-1); }
      .ge-chip-plain.active { color: var(--ge-brand); border-color: color-mix(in srgb, var(--ge-brand) 30%, transparent); }
      .ge-chip-plain .dot { position: absolute; top: -2px; right: -2px; width: 8px; height: 8px; background: var(--ge-brand); border-radius: 50%; box-shadow: 0 0 8px color-mix(in srgb, var(--ge-brand) 50%, transparent); }
      .ge-sep { width: 1px; height: 20px; background: var(--ge-border); margin: 0 4px; flex-shrink: 0; }
      .ge-spacer { flex: 1; }
      .ge-batch { display: flex; align-items: center; background: var(--ge-panel); border-radius: 8px; border: 1px solid var(--ge-border); height: 32px; padding: 0 4px; margin-left: auto; }
      .ge-batch button { width: 24px; height: 100%; display: flex; align-items: center; justify-content: center; background: none; border: none; color: var(--ge-text-2); cursor: pointer; font-size: 0.85rem; }
      .ge-batch button:hover { color: var(--ge-text-1); }
      .ge-batch span { font-size: 0.78rem; font-family: monospace; font-weight: 600; color: var(--ge-text-1); width: 24px; text-align: center; }

      /* ── Popups ── */
      .ge-popup { position: absolute; bottom: calc(100% + 12px); background: #1a1a1a; border: 1px solid var(--ge-border); border-radius: 24px; box-shadow: 0 8px 32px rgba(0,0,0,0.4); z-index: 100; color: #fff; overflow: hidden; animation: ge-scale-in 0.15s ease-out; }
      .ge-popup-sm { border-radius: 20px; padding: 8px; }
      @keyframes ge-scale-in { from { opacity: 0; transform: scale(0.95) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      .ge-popup-header { display: flex; justify-content: space-between; align-items: center; padding: 16px; border-bottom: 1px solid #27272a; background: rgba(15,15,15,0.5); }
      .ge-popup-header span { font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #a1a1aa; }
      .ge-popup-close { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: none; background: none; color: #a1a1aa; cursor: pointer; font-size: 0.9rem; }
      .ge-popup-close:hover { background: rgba(255,255,255,0.1); }
      .ge-popup-body { max-height: 320px; overflow-y: auto; padding: 8px; }
      .ge-model-row { width: 100%; text-align: left; padding: 12px; border-radius: 12px; display: flex; align-items: center; gap: 12px; cursor: pointer; border: 1px solid transparent; transition: all 0.1s; background: none; color: #fff; }
      .ge-model-row:hover { background: #0f0f0f; }
      .ge-model-row.selected { background: #0f0f0f; border-color: color-mix(in srgb, var(--ge-brand, #CCFF00) 50%, transparent); }
      .ge-model-ava { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1rem; border: 1px solid #27272a; background: #0f0f0f; color: #a1a1aa; }
      .ge-model-row.selected .ge-model-ava { background: var(--ge-brand, #CCFF00); color: #030303; border-color: transparent; }
      .ge-model-info { flex: 1; min-width: 0; }
      .ge-model-name { font-size: 0.85rem; font-weight: 700; display: flex; align-items: center; gap: 6px; }
      .ge-model-name .badge { font-size: 0.55rem; background: rgba(204,255,0,0.2); color: #CCFF00; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em; }
      .ge-model-desc { font-size: 0.65rem; color: #71717a; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .ge-model-check { color: #CCFF00; font-size: 0.9rem; flex-shrink: 0; }
      .ge-ar-row { width: 100%; text-align: left; padding: 10px 12px; border-radius: 8px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; font-size: 0.82rem; font-weight: 500; color: #a1a1aa; transition: all 0.1s; background: none; border: none; }
      .ge-ar-row:hover { background: rgba(255,255,255,0.05); color: #fff; }
      .ge-ar-row.selected { background: #0f0f0f; color: #fff; }
      .ge-ar-row .check { color: #CCFF00; font-size: 0.8rem; }
      .ge-ar-row .left { display: flex; align-items: center; gap: 8px; }
      .ge-popup-title { font-size: 0.6rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #71717a; padding: 8px 12px 4px; }
      .ge-quality-row { width: 100%; text-align: left; padding: 10px 12px; border-radius: 8px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; font-size: 0.82rem; font-weight: 500; color: rgba(255,255,255,0.6); transition: all 0.1s; background: none; border: none; }
      .ge-quality-row:hover { background: rgba(255,255,255,0.05); color: #fff; }
      .ge-quality-row.selected { background: rgba(255,255,255,0.1); color: #fff; }

      /* ── Perspective popup ── */
      .ge-persp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
      .ge-persp-btn { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 8px; border-radius: 12px; font-size: 0.62rem; font-weight: 600; cursor: pointer; border: 1px solid transparent; background: rgba(15,15,15,0.5); color: #a1a1aa; transition: all 0.15s; }
      .ge-persp-btn:hover { border-color: rgba(204,255,0,0.3); color: #fff; }
      .ge-persp-btn.active { background: rgba(204,255,0,0.2); border-color: rgba(204,255,0,0.6); color: #CCFF00; }
      .ge-persp-btn .icon { font-size: 1rem; }

      /* ── Rotate popup ── */
      .ge-rot-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
      .ge-rot-btn { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; cursor: pointer; border: 1px solid transparent; background: var(--ge-surface, #0f0f0f); color: #a1a1aa; transition: all 0.15s; }
      .ge-rot-btn:hover { border-color: rgba(204,255,0,0.3); color: #fff; }
      .ge-rot-btn.active { background: rgba(204,255,0,0.2); border-color: rgba(204,255,0,0.6); color: #CCFF00; }

      /* ── Spinner ── */
      .ge-spinner { width: 48px; height: 48px; border: 3px solid var(--ge-border); border-top-color: var(--ge-brand); border-radius: 50%; animation: ge-spin 0.8s linear infinite; }
      @keyframes ge-spin { to { transform: rotate(360deg); } }

      /* ── Result ── */
      .ge-result img { max-width: 80%; max-height: 60vh; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.2); }
      .ge-result-meta { font-size: 0.85rem; color: var(--ge-text-2); text-align: center; margin-top: 12px; }

      /* ── Gallery strip ── */
      .ge-strip { display: flex; gap: 8px; padding: 8px 20px; overflow-x: auto; z-index: 2; }
      .ge-strip::-webkit-scrollbar { display: none; }
      .ge-thumb { flex-shrink: 0; width: 72px; height: 72px; border-radius: 10px; background: var(--ge-surface); border: 1px solid var(--ge-border); overflow: hidden; cursor: pointer; display: flex; align-items: center; justify-content: center; }
      .ge-thumb:hover { border-color: var(--ge-brand); }
      .ge-thumb img { width: 100%; height: 100%; object-fit: cover; }
      .ge-thumb span { font-size: 0.6rem; color: var(--ge-text-2); padding: 4px; text-align: center; line-height: 1.2; }

      /* ── Brand bar ── */
      .ge-brand-bar { position: absolute; top: 12px; left: 16px; z-index: 3; display: flex; align-items: center; gap: 6px; padding: 6px 12px; background: color-mix(in srgb, var(--ge-panel) 90%, transparent); backdrop-filter: blur(12px); border: 1px solid var(--ge-border); border-radius: 10px; font-size: 0.78rem; font-weight: 600; }
      .ge-brand-dot { width: 10px; height: 10px; border-radius: 50%; }

      /* ── Error ── */
      .ge-error { background: rgba(239,68,68,0.1); color: #ef4444; padding: 8px 16px; border-radius: 8px; font-size: 0.82rem; margin: 0 20px 8px; z-index: 2; }
    </style>

    <div class="ge-studio">
      <!-- Canvas area -->
      <div class="ge-canvas">
        ${
          props.generating
            ? html`
            <div style="display:flex;flex-direction:column;align-items:center;gap:16px;">
              <div class="ge-spinner"></div>
              <div style="font-size:0.95rem;color:var(--ge-text-2);">Generating with ${currentModel.label}...</div>
            </div>`
            : props.lastResult?.imageUrl
              ? html`
              <div class="ge-result">
                <img src=${props.lastResult.imageUrl} alt=${props.lastResult.prompt} />
                <div class="ge-result-meta">${props.lastResult.prompt} &mdash; ${currentModel.label}</div>
              </div>`
              : html`
                  <div class="ge-empty" style="text-align: center">
                    <h2>Your canvas is empty</h2>
                    <p>Enter a prompt below to start creating</p>
                  </div>
                `
        }

        <button class="ge-sync"><span>\uD83D\uDCC1</span> Sync Folder</button>

        ${
          props.activeBrand
            ? html`
          <div class="ge-brand-bar">
            <span class="ge-brand-dot" style="background:${props.activeBrand.colors.primary}"></span>
            ${props.activeBrand.name}
          </div>`
            : nothing
        }
      </div>

      ${props.error ? html`<div class="ge-error">${props.error}</div>` : nothing}

      <!-- Recent generations strip -->
      ${
        props.recentGenerations.length > 0
          ? html`
        <div class="ge-strip">
          ${props.recentGenerations.map(
            (g) => html`
            <div class="ge-thumb" title=${g.prompt}>
              ${g.imageUrl ? html`<img src=${g.imageUrl} alt=${g.prompt} />` : html`<span>${g.prompt.slice(0, 25)}</span>`}
            </div>`,
          )}
        </div>`
          : nothing
      }

      <!-- Control Bar -->
      <div class="ge-bar-wrap">
        <div class="ge-bar">
          <div class="ge-bar-inner">
            <!-- Top row: prompt area -->
            <div class="ge-top-row">
              <button class="ge-add-btn" title="Add Reference Image">+</button>
              <textarea class="ge-prompt" placeholder="Imagine something extraordinary..."
                .value=${props.prompt}
                @input=${(e: Event) => props.onPromptChange((e.target as HTMLTextAreaElement).value)}
                @keydown=${(e: KeyboardEvent) => {
                  if (e.key === "Enter" && !e.shiftKey && props.prompt.trim()) {
                    e.preventDefault();
                    props.onGenerate();
                  }
                }}
              ></textarea>
              <button class="ge-icon-btn" title="Save Prompt">\uD83D\uDD16</button>
              <button class="ge-icon-btn" title="Harmonize / Lighting">\u2600\uFE0F</button>
              <div class="ge-gen-wrap">
                <button class="ge-gen-btn" ?disabled=${props.generating || !props.prompt.trim() || !props.connected}
                  @click=${props.onGenerate}>
                  <span class="sparkle">\u2728</span>
                  ${props.generating ? "GENERATING..." : "GENERATE"}
                </button>
                <span class="ge-gen-label">${currentModel.label}</span>
              </div>
            </div>

            <!-- Chip row -->
            <div class="ge-chips">
              <!-- Model chip -->
              <div class="ge-chip" style="position:relative"
                @click=${(e: Event) => {
                  const p = (e.currentTarget as HTMLElement).querySelector(".ge-popup");
                  if (p)
                    (p as HTMLElement).style.display =
                      (p as HTMLElement).style.display === "block" ? "none" : "block";
                }}>
                <div class="ge-chip-icon">\u26A1</div>
                <span>${currentModel.label}</span>
                <span class="ge-chip-arrow">\u203A</span>
                <div class="ge-popup" style="display:none;left:0;width:320px;" @click=${(e: Event) => e.stopPropagation()}>
                  <div class="ge-popup-header">
                    <span>Select model</span>
                    <button class="ge-popup-close" @click=${(e: Event) => {
                      (
                        (e.currentTarget as HTMLElement).closest(".ge-popup") as HTMLElement
                      ).style.display = "none";
                    }}>\u2715</button>
                  </div>
                  <div class="ge-popup-body">
                    ${IMAGE_MODELS.map(
                      (m) => html`
                      <button class="ge-model-row ${m.value === props.model ? "selected" : ""}"
                        @click=${() => {
                          props.onModelChange(m.value);
                          document
                            .querySelectorAll(".ge-popup")
                            .forEach((p) => ((p as HTMLElement).style.display = "none"));
                        }}>
                        <div class="ge-model-ava">${m.premium ? "\uD83D\uDC51" : "\u26A1"}</div>
                        <div class="ge-model-info">
                          <div class="ge-model-name">${m.label} ${m.badge ? html`<span class="badge">${m.badge}</span>` : nothing}</div>
                          <div class="ge-model-desc">${m.desc}</div>
                        </div>
                        ${
                          m.value === props.model
                            ? html`
                                <span class="ge-model-check">\u2713</span>
                              `
                            : nothing
                        }
                      </button>`,
                    )}
                  </div>
                </div>
              </div>

              <div class="ge-sep"></div>

              <!-- Aspect ratio chip -->
              <div class="ge-chip-plain active" style="position:relative"
                @click=${(e: Event) => {
                  const p = (e.currentTarget as HTMLElement).querySelector(".ge-popup");
                  if (p)
                    (p as HTMLElement).style.display =
                      (p as HTMLElement).style.display === "block" ? "none" : "block";
                }}>
                ${arIcon(ASPECT_RATIOS.find((a) => a.value === props.aspectRatio)?.icon ?? "square")}
                ${props.aspectRatio}
                <div class="ge-popup ge-popup-sm" style="display:none;left:0;width:220px;" @click=${(e: Event) => e.stopPropagation()}>
                  <div class="ge-popup-title">ASPECT RATIO</div>
                  ${ASPECT_RATIOS.map(
                    (ar) => html`
                    <button class="ge-ar-row ${ar.value === props.aspectRatio ? "selected" : ""}"
                      @click=${() => {
                        props.onAspectRatioChange(ar.value);
                        document
                          .querySelectorAll(".ge-popup")
                          .forEach((p) => ((p as HTMLElement).style.display = "none"));
                      }}>
                      <span class="left">${arIcon(ar.icon)} ${ar.label}</span>
                      ${
                        ar.value === props.aspectRatio
                          ? html`
                              <span class="check">\u2713</span>
                            `
                          : nothing
                      }
                    </button>`,
                  )}
                </div>
              </div>

              <!-- Quality chip (Gemini models) -->
              ${
                currentModel.hasQuality
                  ? html`
                <div class="ge-chip-plain" style="position:relative"
                  @click=${(e: Event) => {
                    const p = (e.currentTarget as HTMLElement).querySelector(".ge-popup");
                    if (p)
                      (p as HTMLElement).style.display =
                        (p as HTMLElement).style.display === "block" ? "none" : "block";
                  }}>
                  <span style="color:var(--ge-brand)">\uD83D\uDC8E</span> ${props.resolution}
                  <div class="ge-popup ge-popup-sm" style="display:none;left:0;width:160px;" @click=${(e: Event) => e.stopPropagation()}>
                    <div class="ge-popup-title" style="color:#CCFF00">Quality</div>
                    ${["1K", "2K", "4K"].map(
                      (q) => html`
                      <button class="ge-quality-row ${q === props.resolution ? "selected" : ""}"
                        @click=${() => {
                          props.onResolutionChange(q);
                          document
                            .querySelectorAll(".ge-popup")
                            .forEach((p) => ((p as HTMLElement).style.display = "none"));
                        }}>
                        ${q}
                        ${
                          q === props.resolution
                            ? html`
                                <span style="color: #ccff00">\u2713</span>
                              `
                            : nothing
                        }
                      </button>`,
                    )}
                  </div>
                </div>`
                  : nothing
              }

              <!-- Camera Angle chip -->
              <div class="ge-chip-plain" style="position:relative"
                @click=${(e: Event) => {
                  const p = (e.currentTarget as HTMLElement).querySelector(".ge-popup");
                  if (p)
                    (p as HTMLElement).style.display =
                      (p as HTMLElement).style.display === "block" ? "none" : "block";
                }}>
                \uD83D\uDCF7 Camera Angle
                <div class="ge-popup" style="display:none;right:0;width:340px;" @click=${(e: Event) => e.stopPropagation()}>
                  <div class="ge-popup-header">
                    <span>\uD83D\uDCF7 Camera Perspective</span>
                    <button class="ge-popup-close" @click=${(e: Event) => {
                      (
                        (e.currentTarget as HTMLElement).closest(".ge-popup") as HTMLElement
                      ).style.display = "none";
                    }}>\u2715</button>
                  </div>
                  <div style="padding:16px;">
                    <div class="ge-popup-title" style="padding:0 0 8px">CAMERA ANGLE</div>
                    <div class="ge-persp-grid">
                      ${CAMERA_ANGLES.map(
                        (a) => html`
                        <button class="ge-persp-btn" @click=${() => {}}>
                          <span class="icon">${a.icon}</span>
                          <span>${a.label}</span>
                        </button>`,
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Rotate Object chip -->
              <div class="ge-chip-plain" style="position:relative"
                @click=${(e: Event) => {
                  const p = (e.currentTarget as HTMLElement).querySelector(".ge-popup");
                  if (p)
                    (p as HTMLElement).style.display =
                      (p as HTMLElement).style.display === "block" ? "none" : "block";
                }}>
                \u21BA Rotate Object
                <div class="ge-popup" style="display:none;right:0;width:320px;" @click=${(e: Event) => e.stopPropagation()}>
                  <div class="ge-popup-header">
                    <span>\u21BA Rotate Object</span>
                    <button class="ge-popup-close" @click=${(e: Event) => {
                      (
                        (e.currentTarget as HTMLElement).closest(".ge-popup") as HTMLElement
                      ).style.display = "none";
                    }}>\u2715</button>
                  </div>
                  <div style="padding:16px;">
                    <div class="ge-rot-grid">
                      ${OBJECT_ROTATIONS.map(
                        (r) => html`
                        <button class="ge-rot-btn" @click=${() => {}}>
                          <span style="font-size:1.1rem">${r.icon}</span>
                          <span>${r.label}</span>
                        </button>`,
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Prompts chip -->
              <div class="ge-chip-plain" style="position:relative"
                @click=${(e: Event) => {
                  const p = (e.currentTarget as HTMLElement).querySelector(".ge-popup");
                  if (p)
                    (p as HTMLElement).style.display =
                      (p as HTMLElement).style.display === "block" ? "none" : "block";
                }}>
                \uD83D\uDD16 ${props.style || "Prompts"}
                <div class="ge-popup" style="display:none;left:0;width:300px;" @click=${(e: Event) => e.stopPropagation()}>
                  <div class="ge-popup-header">
                    <span>\uD83D\uDD16 Style Presets</span>
                    <button class="ge-popup-close" @click=${(e: Event) => {
                      (
                        (e.currentTarget as HTMLElement).closest(".ge-popup") as HTMLElement
                      ).style.display = "none";
                    }}>\u2715</button>
                  </div>
                  <div class="ge-popup-body">
                    <button class="ge-ar-row ${!props.style ? "selected" : ""}" @click=${() => {
                      props.onStyleChange("");
                      document
                        .querySelectorAll(".ge-popup")
                        .forEach((p) => ((p as HTMLElement).style.display = "none"));
                    }}>
                      <span>Auto (no style)</span>
                      ${
                        !props.style
                          ? html`
                              <span class="check">\u2713</span>
                            `
                          : nothing
                      }
                    </button>
                    ${STYLE_PRESETS.map(
                      (s) => html`
                      <button class="ge-ar-row ${s === props.style ? "selected" : ""}"
                        @click=${() => {
                          props.onStyleChange(s);
                          document
                            .querySelectorAll(".ge-popup")
                            .forEach((p) => ((p as HTMLElement).style.display = "none"));
                        }}>
                        <span>${s}</span>
                        ${
                          s === props.style
                            ? html`
                                <span class="check">\u2713</span>
                              `
                            : nothing
                        }
                      </button>`,
                    )}
                  </div>
                </div>
              </div>

              <div class="ge-sep"></div>

              <!-- Brand chip -->
              <div class="ge-chip-plain ${props.activeBrand ? "active" : ""}">
                \u2728 ${props.activeBrand?.name ?? "No Brand"}
              </div>

              <div class="ge-spacer"></div>

              <!-- Batch count -->
              <div class="ge-batch">
                <button @click=${() => props.onBatchCountChange(Math.max(1, props.batchCount - 1))}>-</button>
                <span>${props.batchCount}</span>
                <button @click=${() => props.onBatchCountChange(Math.min(currentModel.maxBatch, props.batchCount + 1))}>+</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
