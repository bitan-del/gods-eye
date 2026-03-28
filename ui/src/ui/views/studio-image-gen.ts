// Studio Image Generation — Gods Eye Online exact replica
// Dark/light mode via CSS custom props; popups via reactive state.
// Popups render OUTSIDE the control bar to avoid overflow clipping.

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
  activePopup: string | null;
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
  onPopupToggle: (popup: string) => void;
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
  {
    value: "fal-ai/flux/dev",
    label: "Flux Dev",
    desc: "Fast, high quality. Great for quick iterations.",
    badge: "Fast",
    premium: false,
    hasQuality: false,
    maxBatch: 4,
  },
  {
    value: "fal-ai/flux-pro/v1.1-ultra",
    label: "FLUX Pro Ultra",
    desc: "Best photorealism. Studio-grade output.",
    badge: "Pro",
    premium: true,
    hasQuality: false,
    maxBatch: 4,
  },
  {
    value: "fal-ai/flux-pro",
    label: "FLUX Pro",
    desc: "Professional quality. Balanced speed and detail.",
    badge: "Pro",
    premium: true,
    hasQuality: false,
    maxBatch: 4,
  },
  {
    value: "fal-ai/google/imagen4/preview",
    label: "Imagen 4",
    desc: "Google Imagen 4 via fal. Photorealistic.",
    badge: "Google",
    premium: true,
    hasQuality: false,
    maxBatch: 4,
  },
  {
    value: "fal-ai/nano-banana-2",
    label: "Nano Banana 2",
    desc: "Gemini 3.1 Flash Image. Newest Google via fal.",
    badge: "NEW",
    premium: false,
    hasQuality: false,
    maxBatch: 4,
  },
  {
    value: "fal-ai/nano-banana-pro",
    label: "Nano Banana Pro",
    desc: "Gemini 3 Pro Image. Best quality via fal.",
    badge: "Pro",
    premium: true,
    hasQuality: false,
    maxBatch: 4,
  },
  {
    value: "fal-ai/nano-banana",
    label: "Nano Banana",
    desc: "Gemini 2.5 Flash Image. Stable Google via fal.",
    badge: "Google",
    premium: false,
    hasQuality: false,
    maxBatch: 4,
  },
  {
    value: "fal-ai/recraft-v3",
    label: "Recraft V3",
    desc: "Outstanding design, illustrations, and typography.",
    badge: "Design",
    premium: false,
    hasQuality: false,
    maxBatch: 4,
  },
  {
    value: "fal-ai/ideogram/v3",
    label: "Ideogram V3",
    desc: "Excellent text rendering in images.",
    badge: "Text",
    premium: false,
    hasQuality: false,
    maxBatch: 4,
  },
  {
    value: "fal-ai/stable-diffusion-v35-large",
    label: "SD 3.5 Large",
    desc: "Stability AI latest. Versatile and creative.",
    badge: "SD",
    premium: false,
    hasQuality: false,
    maxBatch: 4,
  },
  {
    value: "fal-ai/flux/schnell",
    label: "Flux Schnell",
    desc: "Fastest model. Instant results, good quality.",
    badge: "Fastest",
    premium: false,
    hasQuality: false,
    maxBatch: 4,
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
  { label: "Turn Left", icon: "\u21BA", value: "rotate-left" },
  { label: "Turn Right", icon: "\u21BB", value: "rotate-right" },
  { label: "Face Forward", icon: "\u2193", value: "face-forward" },
  { label: "Face Away", icon: "\u2191", value: "face-away" },
  { label: "Tilt Up", icon: "\u2197", value: "tilt-up" },
  { label: "Tilt Down", icon: "\u2198", value: "tilt-down" },
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

const SHOT_DISTANCES = [
  { label: "Extreme Close", icon: "\uD83D\uDD0D", value: "extreme-close" },
  { label: "Close-Up", icon: "\uD83D\uDCF7", value: "close-up" },
  { label: "Medium", icon: "\uD83E\uDDCD", value: "medium" },
  { label: "Wide", icon: "\uD83D\uDDBC\uFE0F", value: "wide" },
  { label: "Extreme Wide", icon: "\uD83C\uDF0D", value: "extreme-wide" },
];

function arSvg(icon: string): TemplateResult {
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

// Render a popup as a fixed overlay anchored above the control bar
function renderPopup(
  ap: string | null,
  id: string,
  onClose: () => void,
  content: TemplateResult,
  width = 320,
): TemplateResult {
  if (ap !== id) {
    return html`${nothing}`;
  }
  return html`
    <div class="gs-overlay" @click=${onClose}>
      <div class="gs-popup" style="width:${width}px" @click=${(e: Event) => e.stopPropagation()}>
        ${content}
      </div>
    </div>
  `;
}

export function renderStudioImageGen(props: StudioImageGenProps): TemplateResult {
  const cur = IMAGE_MODELS.find((m) => m.value === props.model) ?? IMAGE_MODELS[0];
  const ap = props.activePopup;
  const close = () => props.onPopupToggle("");

  return html`
    <style>
      /* ---- Theme variables ---- */
      .gs{--bg:#fff;--sf:#f4f4f5;--pn:#fff;--bd:#e4e4e7;--br:#1a73e8;--t1:#202124;--t2:#5f6368;--dt:#e4e4e7;--pop-bg:#fff;--pop-bd:#dadce0;--pop-t:#202124;--pop-t2:#5f6368;--pop-hover:#f1f3f4;--pop-sel:#e8f0fe;--pop-check:#1a73e8}
      @media(prefers-color-scheme:dark){.gs{--bg:#030303;--sf:#0f0f0f;--pn:#141414;--bd:#27272a;--br:#CCFF00;--t1:#fff;--t2:#a1a1aa;--dt:#1a1a1a;--pop-bg:#1a1a1a;--pop-bd:#27272a;--pop-t:#fff;--pop-t2:#a1a1aa;--pop-hover:#0f0f0f;--pop-sel:rgba(204,255,0,.1);--pop-check:#CCFF00}}
      :root[data-theme-mode=dark] .gs{--bg:#030303;--sf:#0f0f0f;--pn:#141414;--bd:#27272a;--br:#CCFF00;--t1:#fff;--t2:#a1a1aa;--dt:#1a1a1a;--pop-bg:#1a1a1a;--pop-bd:#27272a;--pop-t:#fff;--pop-t2:#a1a1aa;--pop-hover:#0f0f0f;--pop-sel:rgba(204,255,0,.1);--pop-check:#CCFF00}
      :root[data-theme-mode=light] .gs{--bg:#fff;--sf:#f4f4f5;--pn:#fff;--bd:#e4e4e7;--br:#1a73e8;--t1:#202124;--t2:#5f6368;--dt:#e4e4e7;--pop-bg:#fff;--pop-bd:#dadce0;--pop-t:#202124;--pop-t2:#5f6368;--pop-hover:#f1f3f4;--pop-sel:#e8f0fe;--pop-check:#1a73e8}

      /* ---- Layout ---- */
      .gs{display:flex;flex-direction:column;height:calc(100vh - 60px);background:var(--bg);background-image:radial-gradient(var(--dt) 1px,transparent 1px);background-size:24px 24px;color:var(--t1);font-family:'Google Sans','Inter',-apple-system,sans-serif;position:relative}
      .gs *{box-sizing:border-box}

      /* Canvas area */
      .gs-cv{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;z-index:1}
      .gs-eh h2{font-size:1.5rem;font-weight:600;margin:0 0 8px}
      .gs-eh p{font-size:.95rem;color:var(--t2);margin:0}

      /* Top buttons */
      .gs-sy{position:absolute;top:12px;right:16px;display:flex;align-items:center;gap:6px;padding:8px 16px;background:var(--pn);border:1px solid var(--bd);border-radius:12px;font-size:.82rem;font-weight:600;cursor:pointer;color:var(--t1);z-index:3}
      .gs-sy:hover{border-color:var(--br)}
      .gs-bb{position:absolute;top:12px;left:16px;z-index:3;display:flex;align-items:center;gap:6px;padding:6px 12px;background:var(--pn);border:1px solid var(--bd);border-radius:10px;font-size:.78rem;font-weight:600}
      .gs-bd-dot{width:10px;height:10px;border-radius:50%}

      /* Error */
      .gs-er{background:rgba(239,68,68,.1);color:#ef4444;padding:8px 16px;border-radius:8px;font-size:.82rem;margin:0 20px 8px;z-index:2}

      /* Bottom bar wrapper */
      .gs-bw{position:relative;z-index:40;padding:0 16px 16px;display:flex;flex-direction:column;align-items:center}

      /* Glass bar */
      .gs-bar{position:relative;width:100%;max-width:900px;background:color-mix(in srgb,var(--pn) 80%,transparent);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid color-mix(in srgb,var(--t1) 5%,transparent);border-radius:28px;padding:6px;box-shadow:0 20px 40px -10px rgba(0,0,0,.3)}
      .gs-in{display:flex;flex-direction:column;gap:6px}

      /* Input row */
      .gs-top{display:flex;align-items:center;gap:10px;padding:4px 6px 0}
      .gs-ab{width:40px;height:40px;border-radius:50%;background:var(--sf);border:1px solid var(--bd);display:flex;align-items:center;justify-content:center;color:var(--t2);cursor:pointer;flex-shrink:0;font-size:1.2rem}
      .gs-ab:hover{border-color:var(--br);color:var(--t1)}
      .gs-pr{flex:1;background:transparent;border:none;outline:none;color:var(--t1);font-size:.9rem;font-weight:500;padding:8px 4px;resize:none;height:48px;font-family:inherit;line-height:1.6}
      .gs-pr::placeholder{color:color-mix(in srgb,var(--t2) 50%,transparent)}
      .gs-ib{width:40px;height:48px;display:flex;align-items:center;justify-content:center;background:none;border:none;color:var(--t2);cursor:pointer;border-radius:12px;font-size:1.1rem;flex-shrink:0}
      .gs-ib:hover{background:var(--sf);color:var(--t1)}

      /* Generate button */
      .gs-gw{display:flex;flex-direction:column;align-items:flex-end;gap:2px;flex-shrink:0}
      .gs-gn{display:flex;align-items:center;gap:8px;height:40px;padding:0 20px;background:var(--br);color:var(--bg);border:none;border-radius:12px;font-size:.7rem;font-weight:800;cursor:pointer;letter-spacing:.08em;text-transform:uppercase;transition:opacity .15s,transform .15s}
      .gs-gn:hover:not(:disabled){transform:scale(1.05)}
      .gs-gn:disabled{opacity:.5;cursor:not-allowed;transform:none}
      .gs-gs{font-size:.55rem;color:var(--t2);font-family:monospace;text-transform:uppercase;opacity:.5;padding-right:4px}

      /* Chip bar */
      .gs-ch{display:flex;align-items:center;gap:8px;background:color-mix(in srgb,var(--sf) 50%,transparent);border-radius:24px;padding:6px;overflow-x:auto;scrollbar-width:none}
      .gs-ch::-webkit-scrollbar{display:none}

      /* Model chip */
      .gs-mc{height:36px;padding:0 12px 0 4px;border-radius:999px;background:var(--pn);border:1px solid var(--bd);display:flex;align-items:center;gap:8px;cursor:pointer;white-space:nowrap;color:var(--t1);font-size:.78rem;font-weight:700;letter-spacing:-.01em;transition:border-color .15s}
      .gs-mc:hover{border-color:color-mix(in srgb,var(--br) 50%,transparent)}
      .gs-ci{width:28px;height:28px;border-radius:50%;background:var(--sf);display:flex;align-items:center;justify-content:center;color:var(--br);font-size:.85rem;transition:background .15s,color .15s}
      .gs-mc:hover .gs-ci{background:var(--br);color:var(--bg)}

      /* Generic chip */
      .gs-cp{height:32px;padding:0 12px;border-radius:8px;background:transparent;border:1px solid transparent;display:flex;align-items:center;gap:6px;cursor:pointer;white-space:nowrap;color:var(--t2);font-size:.78rem;font-weight:500;transition:all .15s}
      .gs-cp:hover{background:color-mix(in srgb,var(--t1) 5%,transparent);color:var(--t1)}
      .gs-cp.on{color:var(--br);border-color:color-mix(in srgb,var(--br) 30%,transparent)}

      /* Separator */
      .gs-sp{width:1px;height:20px;background:var(--bd);margin:0 4px;flex-shrink:0}

      /* Batch counter */
      .gs-bt{display:flex;align-items:center;background:var(--pn);border-radius:8px;border:1px solid var(--bd);height:32px;padding:0 4px;margin-left:auto}
      .gs-bt button{width:24px;height:100%;display:flex;align-items:center;justify-content:center;background:none;border:none;color:var(--t2);cursor:pointer;font-size:.85rem}
      .gs-bt button:hover{color:var(--t1)}
      .gs-bt span{font-size:.78rem;font-family:monospace;font-weight:600;color:var(--t1);width:24px;text-align:center}

      /* ---- POPUP OVERLAY (fixed, outside bar) ---- */
      .gs-overlay{position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;justify-content:center;padding-bottom:120px;background:rgba(0,0,0,.15);animation:gso .12s ease-out}
      @keyframes gso{from{opacity:0}to{opacity:1}}
      .gs-popup{background:var(--pop-bg);border:1px solid var(--pop-bd);border-radius:24px;box-shadow:0 12px 48px rgba(0,0,0,.3);color:var(--pop-t);overflow:hidden;animation:gsi .15s ease-out;max-height:70vh;display:flex;flex-direction:column}
      @keyframes gsi{from{opacity:0;transform:scale(.95) translateY(12px)}to{opacity:1;transform:scale(1) translateY(0)}}

      /* Popup header */
      .gs-ph{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--pop-bd);flex-shrink:0}
      .gs-ph span{font-size:.75rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--pop-t2);display:flex;align-items:center;gap:8px}
      .gs-px{width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;border:none;background:none;color:var(--pop-t2);cursor:pointer;font-size:.9rem}
      .gs-px:hover{background:var(--pop-hover)}

      /* Popup body */
      .gs-pb{overflow-y:auto;padding:8px;flex:1;min-height:0}

      /* Model row */
      .gs-mr{width:100%;text-align:left;padding:12px;border-radius:12px;display:flex;align-items:center;gap:12px;cursor:pointer;border:1px solid transparent;transition:all .1s;background:none;color:var(--pop-t)}
      .gs-mr:hover{background:var(--pop-hover)}
      .gs-mr.sl{background:var(--pop-sel);border-color:color-mix(in srgb,var(--pop-check) 30%,transparent)}
      .gs-ma{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1rem;border:1px solid var(--pop-bd);background:var(--pop-hover);color:var(--pop-t2)}
      .gs-mr.sl .gs-ma{background:var(--pop-check);color:var(--pop-bg);border-color:transparent}
      .gs-mn{font-size:.85rem;font-weight:700;display:flex;align-items:center;gap:6px}
      .gs-mn .bg{font-size:.55rem;background:color-mix(in srgb,var(--pop-check) 15%,transparent);color:var(--pop-check);padding:2px 6px;border-radius:4px;text-transform:uppercase;font-weight:800;letter-spacing:.05em}
      .gs-md{font-size:.65rem;color:var(--pop-t2);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

      /* Aspect ratio / generic row */
      .gs-ar{width:100%;text-align:left;padding:10px 12px;border-radius:8px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;font-size:.82rem;font-weight:500;color:var(--pop-t2);transition:all .1s;background:none;border:none}
      .gs-ar:hover{background:var(--pop-hover);color:var(--pop-t)}
      .gs-ar.sl{background:var(--pop-sel);color:var(--pop-t)}

      /* Section title inside popup */
      .gs-pt{font-size:.6rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--pop-t2);padding:8px 12px 4px}

      /* Pro tip box */
      .gs-tip{border:1px dashed var(--pop-bd);border-radius:12px;padding:12px 16px;margin:12px 16px 8px;font-size:.78rem;color:var(--pop-t2);line-height:1.5}
      .gs-tip b{color:var(--pop-check);font-weight:700}

      /* Camera angle grid */
      .gs-cg{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
      .gs-cb{display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 8px;border-radius:12px;font-size:.62rem;font-weight:600;cursor:pointer;border:1px solid transparent;background:var(--pop-hover);color:var(--pop-t2);transition:all .15s}
      .gs-cb:hover{border-color:color-mix(in srgb,var(--pop-check) 30%,transparent);color:var(--pop-t)}

      /* Rotate grid */
      .gs-rg{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
      .gs-rb{display:flex;align-items:center;gap:10px;padding:12px;border-radius:12px;font-size:.75rem;font-weight:600;cursor:pointer;border:1px solid transparent;background:var(--pop-hover);color:var(--pop-t2);transition:all .15s}
      .gs-rb:hover{border-color:color-mix(in srgb,var(--pop-check) 30%,transparent);color:var(--pop-t)}

      /* Shot distance grid */
      .gs-sd{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
      .gs-sb{display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 4px;border-radius:12px;font-size:.58rem;font-weight:600;cursor:pointer;border:1px solid transparent;background:var(--pop-hover);color:var(--pop-t2);transition:all .15s;text-align:center}
      .gs-sb:hover{border-color:color-mix(in srgb,var(--pop-check) 30%,transparent);color:var(--pop-t)}

      /* Toggle switch */
      .gs-toggle{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;margin:8px 16px 12px;background:var(--pop-hover);border-radius:12px}
      .gs-toggle-label{font-size:.8rem;font-weight:600;color:var(--pop-t)}
      .gs-toggle-desc{font-size:.65rem;color:var(--pop-t2);margin-top:2px}
      .gs-toggle-sw{width:40px;height:22px;border-radius:11px;background:var(--pop-bd);cursor:pointer;position:relative;border:none;transition:background .2s}
      .gs-toggle-sw::after{content:'';position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;transition:transform .2s}

      /* Saved prompts empty state */
      .gs-empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:40px 20px;color:var(--pop-t2);text-align:center}
      .gs-empty-icon{font-size:2rem;opacity:.4}
      .gs-empty-title{font-size:.9rem;font-weight:600;color:var(--pop-t)}
      .gs-empty-desc{font-size:.78rem;line-height:1.5}

      /* Spinner */
      .gs-sn{width:48px;height:48px;border:3px solid var(--bd);border-top-color:var(--br);border-radius:50%;animation:gss .8s linear infinite}
      @keyframes gss{to{transform:rotate(360deg)}}

      /* Result image */
      .gs-ri img{max-width:80%;max-height:60vh;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.2)}
      .gs-rm{font-size:.85rem;color:var(--t2);text-align:center;margin-top:12px}

      /* Recent thumbnails */
      .gs-st{display:flex;gap:8px;padding:8px 20px;overflow-x:auto;z-index:2}
      .gs-st::-webkit-scrollbar{display:none}
      .gs-th{flex-shrink:0;width:72px;height:72px;border-radius:10px;background:var(--sf);border:1px solid var(--bd);overflow:hidden;cursor:pointer;display:flex;align-items:center;justify-content:center}
      .gs-th:hover{border-color:var(--br)}
      .gs-th img{width:100%;height:100%;object-fit:cover}
      .gs-th span{font-size:.6rem;color:var(--t2);padding:4px;text-align:center;line-height:1.2}
    </style>

    <div class="gs">
      <div class="gs-cv">
        ${
          props.generating
            ? html`<div style="display:flex;flex-direction:column;align-items:center;gap:16px"><div class="gs-sn"></div><div style="font-size:.95rem;color:var(--t2)">Generating with ${cur.label}...</div></div>`
            : props.lastResult?.imageUrl
              ? html`<div class="gs-ri"><img src=${props.lastResult.imageUrl} alt=${props.lastResult.prompt} /><div class="gs-rm">${props.lastResult.prompt}</div></div>`
              : html`
                  <div class="gs-eh" style="text-align: center">
                    <h2>Your canvas is empty</h2>
                    <p>Enter a prompt below to start creating</p>
                  </div>
                `
        }
        <button class="gs-sy" title="Sync your generated images to a folder on your computer">\uD83D\uDCC1 Sync Folder</button>
        ${props.activeBrand ? html`<div class="gs-bb"><span class="gs-bd-dot" style="background:${props.activeBrand.colors.primary}"></span>${props.activeBrand.name}</div>` : nothing}
      </div>

      ${props.error ? html`<div class="gs-er">${props.error}</div>` : nothing}

      ${props.recentGenerations.length > 0 ? html`<div class="gs-st">${props.recentGenerations.map((g) => html`<div class="gs-th" title=${g.prompt}>${g.imageUrl ? html`<img src=${g.imageUrl} alt=${g.prompt} />` : html`<span>${g.prompt.slice(0, 25)}</span>`}</div>`)}</div>` : nothing}

      <!-- Control bar -->
      <div class="gs-bw">
        <div class="gs-bar">
          <div class="gs-in">
            <div class="gs-top">
              <button class="gs-ab" title="Add a reference image — upload a picture to guide the AI on what to create">+</button>
              <textarea class="gs-pr" placeholder="Imagine something extraordinary..."
                .value=${props.prompt}
                @input=${(e: Event) => props.onPromptChange((e.target as HTMLTextAreaElement).value)}
                @keydown=${(e: KeyboardEvent) => {
                  if (e.key === "Enter" && !e.shiftKey && props.prompt.trim()) {
                    e.preventDefault();
                    props.onGenerate();
                  }
                }}></textarea>
              <button class="gs-ib" title="Save this prompt so you can use it again later">\uD83D\uDD16</button>
              <button class="gs-ib" title="Harmonize — let AI improve your prompt to get better results">\u2600\uFE0F</button>
              <div class="gs-gw">
                <button class="gs-gn" title="Click to create your image! Type what you want in the box first." ?disabled=${props.generating || !props.prompt.trim() || !props.connected} @click=${() => props.onGenerate()}>
                  <span>\u2728</span> ${props.generating ? "GENERATING..." : "GENERATE"}
                </button>
                <span class="gs-gs">${cur.label}</span>
              </div>
            </div>

            <div class="gs-ch">
              <!-- Model chip -->
              <div class="gs-mc" title="Choose which AI model creates your image — each has different strengths" @click=${() => props.onPopupToggle("model")}>
                <div class="gs-ci">\u26A1</div><span>${cur.label}</span><span style="font-size:.65rem;color:var(--t2);margin-left:2px">\u203A</span>
              </div>

              <div class="gs-sp"></div>

              <!-- Aspect Ratio chip -->
              <div class="gs-cp on" title="Pick the shape of your image — square for social posts, landscape for banners, portrait for stories" @click=${() => props.onPopupToggle("aspect")}>
                ${arSvg(ASPECT_RATIOS.find((a) => a.value === props.aspectRatio)?.icon ?? "square")} ${props.aspectRatio}
              </div>

              <!-- Quality chip (if model supports it) -->
              ${
                cur.hasQuality
                  ? html`
                <div class="gs-cp" title="Image quality — higher means sharper and more detailed but takes longer" @click=${() => props.onPopupToggle("quality")}>
                  <span style="color:var(--br)">\uD83D\uDC8E</span> ${props.resolution}
                </div>`
                  : nothing
              }

              <!-- Camera Angle chip -->
              <div class="gs-cp" title="Set the camera viewpoint — like looking up at something, down from above, or tilted to the side" @click=${() => props.onPopupToggle("camera")}>
                \uD83D\uDCF7 Camera Angle
              </div>

              <!-- Rotate Object chip -->
              <div class="gs-cp" title="Rotate or tilt the object in your image — spin it left/right or lean it" @click=${() => props.onPopupToggle("rotate")}>
                \u21BA Rotate Object
              </div>

              <!-- Prompts chip -->
              <div class="gs-cp" title="Save and reuse your favorite prompts" @click=${() => props.onPopupToggle("prompts")}>
                \uD83D\uDD16 Prompts
              </div>

              <div class="gs-sp"></div>

              <!-- Brand chip -->
              <div class="gs-cp ${props.activeBrand ? "on" : ""}" title="Your brand — colors and style from your brand will be applied to the image">\u2728 ${props.activeBrand?.name ?? "No Brand"}</div>

              <!-- Batch counter -->
              <div class="gs-bt" title="How many images to create at once — more images means more options to choose from">
                <button @click=${() => props.onBatchCountChange(Math.max(1, props.batchCount - 1))}>-</button>
                <span>${props.batchCount}</span>
                <button @click=${() => props.onBatchCountChange(Math.min(cur.maxBatch, props.batchCount + 1))}>+</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ========== POPUPS (rendered outside the bar as fixed overlays) ========== -->

      <!-- Model Selector Popup -->
      ${renderPopup(
        ap,
        "model",
        close,
        html`
        <div class="gs-ph"><span>\u26A1 Select Model</span><button class="gs-px" @click=${close}>\u2715</button></div>
        <div class="gs-pb">${IMAGE_MODELS.map(
          (m) => html`
          <button class="gs-mr ${m.value === props.model ? "sl" : ""}" @click=${() => props.onModelChange(m.value)}>
            <div class="gs-ma">${m.premium ? "\uD83D\uDC51" : "\u26A1"}</div>
            <div style="flex:1;min-width:0">
              <div class="gs-mn">${m.label} ${m.badge ? html`<span class="bg">${m.badge}</span>` : nothing}</div>
              <div class="gs-md">${m.desc}</div>
            </div>
            ${
              m.value === props.model
                ? html`
                    <span style="color: var(--pop-check)">\u2713</span>
                  `
                : nothing
            }
          </button>`,
        )}</div>
      `,
        340,
      )}

      <!-- Aspect Ratio Popup -->
      ${renderPopup(
        ap,
        "aspect",
        close,
        html`
        <div class="gs-ph"><span>${arSvg("square")} Aspect Ratio</span><button class="gs-px" @click=${close}>\u2715</button></div>
        <div class="gs-pb">
          ${ASPECT_RATIOS.map(
            (ar) => html`
            <button class="gs-ar ${ar.value === props.aspectRatio ? "sl" : ""}" @click=${() => props.onAspectRatioChange(ar.value)}>
              <span style="display:flex;align-items:center;gap:8px">${arSvg(ar.icon)} ${ar.label}</span>
              ${
                ar.value === props.aspectRatio
                  ? html`
                      <span style="color: var(--pop-check)">\u2713</span>
                    `
                  : nothing
              }
            </button>`,
          )}
        </div>
      `,
        240,
      )}

      <!-- Quality Popup -->
      ${renderPopup(
        ap,
        "quality",
        close,
        html`
        <div class="gs-ph"><span>\uD83D\uDC8E Quality</span><button class="gs-px" @click=${close}>\u2715</button></div>
        <div class="gs-pb">
          ${["1K", "2K", "4K"].map(
            (q) => html`
            <button class="gs-ar ${q === props.resolution ? "sl" : ""}" @click=${() => props.onResolutionChange(q)}>
              ${q}
              ${
                q === props.resolution
                  ? html`
                      <span style="color: var(--pop-check)">\u2713</span>
                    `
                  : nothing
              }
            </button>`,
          )}
        </div>
      `,
        180,
      )}

      <!-- Camera Perspective Popup -->
      ${renderPopup(
        ap,
        "camera",
        close,
        html`
        <div class="gs-ph"><span>\uD83D\uDCF7 Camera Perspective</span><span style="display:flex;align-items:center;gap:8px"><button class="gs-px" style="font-size:.65rem;width:auto;padding:0 8px;border-radius:6px" @click=${close}>\u21BA RESET</button><button class="gs-px" @click=${close}>\u2715</button></span></div>
        <div style="padding:16px;overflow-y:auto">
          <div class="gs-pt" style="padding:0 0 8px">CAMERA ANGLE</div>
          <div class="gs-cg">${CAMERA_ANGLES.map((a) => html`<button class="gs-cb"><span style="font-size:1.2rem">${a.icon}</span><span>${a.label}</span></button>`)}</div>

          <div class="gs-pt" style="padding:16px 0 8px">SHOT DISTANCE</div>
          <div class="gs-sd">${SHOT_DISTANCES.map((d) => html`<button class="gs-sb"><span style="font-size:1rem">${d.icon}</span><span>${d.label}</span></button>`)}</div>

          <div class="gs-toggle">
            <div>
              <div class="gs-toggle-label">Subject Facing Camera</div>
              <div class="gs-toggle-desc">Fix sideways / profile orientation</div>
            </div>
            <button class="gs-toggle-sw"></button>
          </div>
        </div>
      `,
        380,
      )}

      <!-- Rotate Object Popup -->
      ${renderPopup(
        ap,
        "rotate",
        close,
        html`
        <div class="gs-ph"><span>\u21BA Rotate Object</span><button class="gs-px" @click=${close}>\u2715</button></div>
        <div style="padding:16px;overflow-y:auto">
          <div class="gs-tip"><b>Pro Tip:</b> Draw your mask slightly larger than the original object to give the AI room to rotate the corners!</div>
          <div class="gs-rg">${OBJECT_ROTATIONS.map((r) => html`<button class="gs-rb"><span style="font-size:1.1rem">${r.icon}</span><span>${r.label}</span></button>`)}</div>
        </div>
      `,
        340,
      )}

      <!-- Saved Prompts Popup -->
      ${renderPopup(
        ap,
        "prompts",
        close,
        html`
        <div class="gs-ph"><span>\uD83D\uDD16 Saved Prompts</span><button class="gs-px" @click=${close}>\u2715</button></div>
        <div class="gs-pb">
          <div class="gs-empty">
            <div class="gs-empty-icon">\uD83D\uDD16</div>
            <div class="gs-empty-title">No saved prompts yet</div>
            <div class="gs-empty-desc">Click the bookmark icon in the input area to save your favorite prompts here.</div>
          </div>
        </div>
      `,
        320,
      )}

      <!-- Style Presets Popup -->
      ${renderPopup(
        ap,
        "styles",
        close,
        html`
        <div class="gs-ph"><span>\uD83C\uDFA8 Style Presets</span><button class="gs-px" @click=${close}>\u2715</button></div>
        <div class="gs-pb">
          <button class="gs-ar ${!props.style ? "sl" : ""}" @click=${() => props.onStyleChange("")}>
            <span>Auto (no style)</span>
            ${
              !props.style
                ? html`
                    <span style="color: var(--pop-check)">\u2713</span>
                  `
                : nothing
            }
          </button>
          ${STYLE_PRESETS.map(
            (
              s,
            ) => html`<button class="gs-ar ${s === props.style ? "sl" : ""}" @click=${() => props.onStyleChange(s)}>
              <span>${s}</span>
              ${
                s === props.style
                  ? html`
                      <span style="color: var(--pop-check)">\u2713</span>
                    `
                  : nothing
              }
            </button>`,
          )}
        </div>
      `,
        280,
      )}
    </div>
  `;
}
