// Studio Image Generation — Gods Eye Online exact replica
// Dark/light mode via CSS custom props; popups via reactive state.

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
    value: "gemini-3.1-flash",
    label: "Gemini 3.1 Flash",
    desc: "Google newest. Pro quality at Flash speed.",
    badge: "NEW",
    premium: false,
    hasQuality: true,
    maxBatch: 4,
  },
  {
    value: "gemini-3.0-pro",
    label: "Gemini 3.0 Pro",
    desc: "Google flagship generation model",
    badge: "Pro",
    premium: true,
    hasQuality: true,
    maxBatch: 4,
  },
  {
    value: "fal-ai/seedream-4.5",
    label: "Seedream 4.5",
    desc: "ByteDance newest. Up to 4K output.",
    badge: "NEW",
    premium: false,
    hasQuality: false,
    maxBatch: 4,
  },
  {
    value: "gpt-image-1",
    label: "GPT Image 1",
    desc: "OpenAI GPT Image 1",
    badge: "OpenAI",
    premium: true,
    hasQuality: false,
    maxBatch: 4,
  },
  {
    value: "fal-ai/flux-2-ultra",
    label: "FLUX.2 Ultra",
    desc: "Black Forest Labs. Photorealism.",
    badge: "BFL",
    premium: true,
    hasQuality: false,
    maxBatch: 4,
  },
  {
    value: "fal-ai/reve-1",
    label: "Reve Image 1.0",
    desc: "Outstanding color accuracy.",
    badge: "Reve",
    premium: false,
    hasQuality: false,
    maxBatch: 4,
  },
  {
    value: "fal-ai/flux/dev",
    label: "Flux Dev",
    desc: "Fast dev model from fal.ai.",
    badge: "Fast",
    premium: false,
    hasQuality: false,
    maxBatch: 4,
  },
  {
    value: "dall-e-3",
    label: "DALL-E 3",
    desc: "OpenAI DALL-E 3",
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

export function renderStudioImageGen(props: StudioImageGenProps): TemplateResult {
  const cur = IMAGE_MODELS.find((m) => m.value === props.model) ?? IMAGE_MODELS[0];
  const ap = props.activePopup;
  const backdrop = () =>
    html`<div style="position:fixed;inset:0;z-index:49;" @click=${() => props.onPopupToggle("")}></div>`;

  return html`
    <style>
      .gs{--bg:#fff;--sf:#f4f4f5;--pn:#fff;--bd:#e4e4e7;--br:#000;--t1:#000;--t2:#52525b;--dt:#e4e4e7}
      @media(prefers-color-scheme:dark){.gs{--bg:#030303;--sf:#0f0f0f;--pn:#141414;--bd:#27272a;--br:#CCFF00;--t1:#fff;--t2:#a1a1aa;--dt:#1a1a1a}}
      :root.dark .gs,.dark .gs{--bg:#030303;--sf:#0f0f0f;--pn:#141414;--bd:#27272a;--br:#CCFF00;--t1:#fff;--t2:#a1a1aa;--dt:#1a1a1a}
      .gs{display:flex;flex-direction:column;height:calc(100vh - 60px);background:var(--bg);background-image:radial-gradient(var(--dt) 1px,transparent 1px);background-size:24px 24px;color:var(--t1);font-family:'Inter',-apple-system,sans-serif;position:relative}
      .gs *{box-sizing:border-box}
      .gs-cv{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;z-index:2}
      .gs-eh h2{font-size:1.5rem;font-weight:600;margin:0 0 8px}
      .gs-eh p{font-size:.95rem;color:var(--t2);margin:0}
      .gs-sy{position:absolute;top:12px;right:16px;display:flex;align-items:center;gap:6px;padding:8px 16px;background:var(--pn);border:1px solid var(--bd);border-radius:12px;font-size:.82rem;font-weight:600;cursor:pointer;color:var(--t1);z-index:3}
      .gs-sy:hover{border-color:var(--br)}
      .gs-bb{position:absolute;top:12px;left:16px;z-index:3;display:flex;align-items:center;gap:6px;padding:6px 12px;background:var(--pn);border:1px solid var(--bd);border-radius:10px;font-size:.78rem;font-weight:600}
      .gs-bd{width:10px;height:10px;border-radius:50%}
      .gs-er{background:rgba(239,68,68,.1);color:#ef4444;padding:8px 16px;border-radius:8px;font-size:.82rem;margin:0 20px 8px;z-index:2}
      .gs-bw{position:relative;z-index:40;padding:0 16px 16px;display:flex;justify-content:center}
      .gs-bar{position:relative;width:100%;max-width:900px;background:color-mix(in srgb,var(--pn) 80%,transparent);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid color-mix(in srgb,var(--t1) 5%,transparent);border-radius:28px;padding:6px;box-shadow:0 20px 40px -10px rgba(0,0,0,.3)}
      .gs-in{display:flex;flex-direction:column;gap:6px}
      .gs-top{display:flex;align-items:center;gap:10px;padding:4px 6px 0}
      .gs-ab{width:40px;height:40px;border-radius:50%;background:var(--sf);border:1px solid var(--bd);display:flex;align-items:center;justify-content:center;color:var(--t2);cursor:pointer;flex-shrink:0;font-size:1.2rem}
      .gs-ab:hover{border-color:var(--br);color:var(--t1)}
      .gs-pr{flex:1;background:transparent;border:none;outline:none;color:var(--t1);font-size:.9rem;font-weight:500;padding:8px 4px;resize:none;height:48px;font-family:inherit;line-height:1.6}
      .gs-pr::placeholder{color:color-mix(in srgb,var(--t2) 50%,transparent)}
      .gs-ib{width:40px;height:48px;display:flex;align-items:center;justify-content:center;background:none;border:none;color:var(--t2);cursor:pointer;border-radius:12px;font-size:1.1rem;flex-shrink:0}
      .gs-ib:hover{background:var(--sf);color:var(--t1)}
      .gs-gw{display:flex;flex-direction:column;align-items:flex-end;gap:2px;flex-shrink:0}
      .gs-gn{display:flex;align-items:center;gap:8px;height:40px;padding:0 20px;background:var(--br);color:var(--bg);border:none;border-radius:12px;font-size:.7rem;font-weight:800;cursor:pointer;letter-spacing:.08em;text-transform:uppercase;transition:opacity .15s,transform .15s}
      .gs-gn:hover:not(:disabled){transform:scale(1.05)}
      .gs-gn:disabled{opacity:.5;cursor:not-allowed;transform:none}
      .gs-gs{font-size:.55rem;color:var(--t2);font-family:monospace;text-transform:uppercase;opacity:.5;padding-right:4px}
      .gs-ch{display:flex;align-items:center;gap:8px;background:color-mix(in srgb,var(--sf) 50%,transparent);border-radius:24px;padding:6px;overflow-x:auto}
      .gs-ch::-webkit-scrollbar{display:none}
      .gs-mc{height:36px;padding:0 12px 0 4px;border-radius:999px;background:var(--pn);border:1px solid var(--bd);display:flex;align-items:center;gap:8px;cursor:pointer;white-space:nowrap;color:var(--t1);font-size:.78rem;font-weight:700;letter-spacing:-.01em;transition:border-color .15s;position:relative}
      .gs-mc:hover{border-color:color-mix(in srgb,var(--br) 50%,transparent)}
      .gs-ci{width:28px;height:28px;border-radius:50%;background:var(--sf);display:flex;align-items:center;justify-content:center;color:var(--br);font-size:.85rem;transition:background .15s,color .15s}
      .gs-mc:hover .gs-ci{background:var(--br);color:var(--bg)}
      .gs-cp{height:32px;padding:0 12px;border-radius:8px;background:transparent;border:1px solid transparent;display:flex;align-items:center;gap:6px;cursor:pointer;white-space:nowrap;color:var(--t2);font-size:.78rem;font-weight:500;transition:all .15s;position:relative}
      .gs-cp:hover{background:color-mix(in srgb,var(--t1) 5%,transparent);color:var(--t1)}
      .gs-cp.on{color:var(--br);border-color:color-mix(in srgb,var(--br) 30%,transparent)}
      .gs-sp{width:1px;height:20px;background:var(--bd);margin:0 4px;flex-shrink:0}
      .gs-bt{display:flex;align-items:center;background:var(--pn);border-radius:8px;border:1px solid var(--bd);height:32px;padding:0 4px;margin-left:auto}
      .gs-bt button{width:24px;height:100%;display:flex;align-items:center;justify-content:center;background:none;border:none;color:var(--t2);cursor:pointer;font-size:.85rem}
      .gs-bt button:hover{color:var(--t1)}
      .gs-bt span{font-size:.78rem;font-family:monospace;font-weight:600;color:var(--t1);width:24px;text-align:center}
      .gs-pop{position:absolute;bottom:calc(100% + 12px);background:#1a1a1a;border:1px solid #27272a;border-radius:24px;box-shadow:0 8px 32px rgba(0,0,0,.4);z-index:100;color:#fff;overflow:hidden;animation:gsi .15s ease-out}
      .gs-pop-s{border-radius:20px;padding:8px}
      @keyframes gsi{from{opacity:0;transform:scale(.95) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
      .gs-ph{display:flex;justify-content:space-between;align-items:center;padding:16px;border-bottom:1px solid #27272a;background:rgba(15,15,15,.5)}
      .gs-ph span{font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#a1a1aa}
      .gs-px{width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;border:none;background:none;color:#a1a1aa;cursor:pointer;font-size:.9rem}
      .gs-px:hover{background:rgba(255,255,255,.1)}
      .gs-pb{max-height:320px;overflow-y:auto;padding:8px}
      .gs-mr{width:100%;text-align:left;padding:12px;border-radius:12px;display:flex;align-items:center;gap:12px;cursor:pointer;border:1px solid transparent;transition:all .1s;background:none;color:#fff}
      .gs-mr:hover{background:#0f0f0f}
      .gs-mr.sl{background:#0f0f0f;border-color:rgba(204,255,0,.5)}
      .gs-ma{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1rem;border:1px solid #27272a;background:#0f0f0f;color:#a1a1aa}
      .gs-mr.sl .gs-ma{background:#CCFF00;color:#030303;border-color:transparent}
      .gs-mn{font-size:.85rem;font-weight:700;display:flex;align-items:center;gap:6px}
      .gs-mn .bg{font-size:.55rem;background:rgba(204,255,0,.2);color:#CCFF00;padding:2px 6px;border-radius:4px;text-transform:uppercase;font-weight:800;letter-spacing:.05em}
      .gs-md{font-size:.65rem;color:#71717a;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .gs-ar{width:100%;text-align:left;padding:10px 12px;border-radius:8px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;font-size:.82rem;font-weight:500;color:#a1a1aa;transition:all .1s;background:none;border:none}
      .gs-ar:hover{background:rgba(255,255,255,.05);color:#fff}
      .gs-ar.sl{background:#0f0f0f;color:#fff}
      .gs-pt{font-size:.6rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#71717a;padding:8px 12px 4px}
      .gs-cg{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
      .gs-cb{display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 8px;border-radius:12px;font-size:.62rem;font-weight:600;cursor:pointer;border:1px solid transparent;background:rgba(15,15,15,.5);color:#a1a1aa;transition:all .15s}
      .gs-cb:hover{border-color:rgba(204,255,0,.3);color:#fff}
      .gs-rg{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
      .gs-rb{display:flex;align-items:center;gap:10px;padding:12px;border-radius:12px;font-size:.75rem;font-weight:600;cursor:pointer;border:1px solid transparent;background:#0f0f0f;color:#a1a1aa;transition:all .15s}
      .gs-rb:hover{border-color:rgba(204,255,0,.3);color:#fff}
      .gs-sn{width:48px;height:48px;border:3px solid var(--bd);border-top-color:var(--br);border-radius:50%;animation:gss .8s linear infinite}
      @keyframes gss{to{transform:rotate(360deg)}}
      .gs-ri img{max-width:80%;max-height:60vh;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.2)}
      .gs-rm{font-size:.85rem;color:var(--t2);text-align:center;margin-top:12px}
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
        <button class="gs-sy">\uD83D\uDCC1 Sync Folder</button>
        ${props.activeBrand ? html`<div class="gs-bb"><span class="gs-bd" style="background:${props.activeBrand.colors.primary}"></span>${props.activeBrand.name}</div>` : nothing}
      </div>

      ${props.error ? html`<div class="gs-er">${props.error}</div>` : nothing}

      ${props.recentGenerations.length > 0 ? html`<div class="gs-st">${props.recentGenerations.map((g) => html`<div class="gs-th" title=${g.prompt}>${g.imageUrl ? html`<img src=${g.imageUrl} alt=${g.prompt} />` : html`<span>${g.prompt.slice(0, 25)}</span>`}</div>`)}</div>` : nothing}

      ${ap ? backdrop() : nothing}

      <div class="gs-bw">
        <div class="gs-bar">
          <div class="gs-in">
            <div class="gs-top">
              <button class="gs-ab" title="Add Reference Image">+</button>
              <textarea class="gs-pr" placeholder="Imagine something extraordinary..."
                .value=${props.prompt}
                @input=${(e: Event) => props.onPromptChange((e.target as HTMLTextAreaElement).value)}
                @keydown=${(e: KeyboardEvent) => {
                  if (e.key === "Enter" && !e.shiftKey && props.prompt.trim()) {
                    e.preventDefault();
                    props.onGenerate();
                  }
                }}></textarea>
              <button class="gs-ib" title="Save Prompt">\uD83D\uDD16</button>
              <button class="gs-ib" title="Harmonize">\u2600\uFE0F</button>
              <div class="gs-gw">
                <button class="gs-gn" ?disabled=${props.generating || !props.prompt.trim() || !props.connected} @click=${() => props.onGenerate()}>
                  <span>\u2728</span> ${props.generating ? "GENERATING..." : "GENERATE"}
                </button>
                <span class="gs-gs">${cur.label}</span>
              </div>
            </div>

            <div class="gs-ch">
              <!-- Model -->
              <div class="gs-mc" @click=${(e: Event) => {
                e.stopPropagation();
                props.onPopupToggle("model");
              }}>
                <div class="gs-ci">\u26A1</div><span>${cur.label}</span><span style="font-size:.65rem;color:var(--t2);margin-left:2px">\u203A</span>
                ${
                  ap === "model"
                    ? html`
                  <div class="gs-pop" style="left:0;width:320px" @click=${(e: Event) => e.stopPropagation()}>
                    <div class="gs-ph"><span>Select model</span><button class="gs-px" @click=${() => props.onPopupToggle("model")}>\u2715</button></div>
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
                                <span style="color: #ccff00">\u2713</span>
                              `
                            : nothing
                        }
                      </button>`,
                    )}</div>
                  </div>`
                    : nothing
                }
              </div>

              <div class="gs-sp"></div>

              <!-- Aspect Ratio -->
              <div class="gs-cp on" @click=${(e: Event) => {
                e.stopPropagation();
                props.onPopupToggle("aspect");
              }}>
                ${arSvg(ASPECT_RATIOS.find((a) => a.value === props.aspectRatio)?.icon ?? "square")} ${props.aspectRatio}
                ${
                  ap === "aspect"
                    ? html`
                  <div class="gs-pop gs-pop-s" style="left:0;width:220px" @click=${(e: Event) => e.stopPropagation()}>
                    <div class="gs-pt">ASPECT RATIO</div>
                    ${ASPECT_RATIOS.map(
                      (ar) => html`
                      <button class="gs-ar ${ar.value === props.aspectRatio ? "sl" : ""}" @click=${() => props.onAspectRatioChange(ar.value)}>
                        <span style="display:flex;align-items:center;gap:8px">${arSvg(ar.icon)} ${ar.label}</span>
                        ${
                          ar.value === props.aspectRatio
                            ? html`
                                <span style="color: #ccff00">\u2713</span>
                              `
                            : nothing
                        }
                      </button>`,
                    )}
                  </div>`
                    : nothing
                }
              </div>

              ${
                cur.hasQuality
                  ? html`
                <div class="gs-cp" @click=${(e: Event) => {
                  e.stopPropagation();
                  props.onPopupToggle("quality");
                }}>
                  <span style="color:var(--br)">\uD83D\uDC8E</span> ${props.resolution}
                  ${
                    ap === "quality"
                      ? html`
                    <div class="gs-pop gs-pop-s" style="left:0;width:160px" @click=${(e: Event) => e.stopPropagation()}>
                      <div class="gs-pt" style="color:#CCFF00">Quality</div>
                      ${["1K", "2K", "4K"].map(
                        (q) => html`
                        <button class="gs-ar ${q === props.resolution ? "sl" : ""}" @click=${() => props.onResolutionChange(q)}>
                          ${q} ${
                            q === props.resolution
                              ? html`
                                  <span style="color: #ccff00">\u2713</span>
                                `
                              : nothing
                          }
                        </button>`,
                      )}
                    </div>`
                      : nothing
                  }
                </div>`
                  : nothing
              }

              <div class="gs-cp" @click=${(e: Event) => {
                e.stopPropagation();
                props.onPopupToggle("camera");
              }}>
                \uD83D\uDCF7 Camera Angle
                ${
                  ap === "camera"
                    ? html`
                  <div class="gs-pop" style="right:0;width:340px" @click=${(e: Event) => e.stopPropagation()}>
                    <div class="gs-ph"><span>\uD83D\uDCF7 Camera Perspective</span><button class="gs-px" @click=${() => props.onPopupToggle("camera")}>\u2715</button></div>
                    <div style="padding:16px"><div class="gs-pt" style="padding:0 0 8px">CAMERA ANGLE</div>
                      <div class="gs-cg">${CAMERA_ANGLES.map((a) => html`<button class="gs-cb"><span style="font-size:1rem">${a.icon}</span><span>${a.label}</span></button>`)}</div>
                    </div>
                  </div>`
                    : nothing
                }
              </div>

              <div class="gs-cp" @click=${(e: Event) => {
                e.stopPropagation();
                props.onPopupToggle("rotate");
              }}>
                \u21BA Rotate Object
                ${
                  ap === "rotate"
                    ? html`
                  <div class="gs-pop" style="right:0;width:320px" @click=${(e: Event) => e.stopPropagation()}>
                    <div class="gs-ph"><span>\u21BA Rotate Object</span><button class="gs-px" @click=${() => props.onPopupToggle("rotate")}>\u2715</button></div>
                    <div style="padding:16px"><div class="gs-rg">${OBJECT_ROTATIONS.map((r) => html`<button class="gs-rb"><span style="font-size:1.1rem">${r.icon}</span><span>${r.label}</span></button>`)}</div></div>
                  </div>`
                    : nothing
                }
              </div>

              <div class="gs-cp" @click=${(e: Event) => {
                e.stopPropagation();
                props.onPopupToggle("prompts");
              }}>
                \uD83D\uDD16 Prompts
                ${
                  ap === "prompts"
                    ? html`
                  <div class="gs-pop" style="left:0;width:300px" @click=${(e: Event) => e.stopPropagation()}>
                    <div class="gs-ph"><span>\uD83C\uDFA8 Style Presets</span><button class="gs-px" @click=${() => props.onPopupToggle("prompts")}>\u2715</button></div>
                    <div class="gs-pb">
                      <button class="gs-ar ${!props.style ? "sl" : ""}" @click=${() => props.onStyleChange("")}><span>Auto (no style)</span>${
                        !props.style
                          ? html`
                              <span style="color: #ccff00">\u2713</span>
                            `
                          : nothing
                      }</button>
                      ${STYLE_PRESETS.map(
                        (s) =>
                          html`<button class="gs-ar ${s === props.style ? "sl" : ""}" @click=${() => props.onStyleChange(s)}><span>${s}</span>${
                            s === props.style
                              ? html`
                                  <span style="color: #ccff00">\u2713</span>
                                `
                              : nothing
                          }</button>`,
                      )}
                    </div>
                  </div>`
                    : nothing
                }
              </div>

              <div class="gs-sp"></div>
              <div class="gs-cp ${props.activeBrand ? "on" : ""}">\u2728 ${props.activeBrand?.name ?? "No Brand"}</div>

              <div class="gs-bt">
                <button @click=${() => props.onBatchCountChange(Math.max(1, props.batchCount - 1))}>-</button>
                <span>${props.batchCount}</span>
                <button @click=${() => props.onBatchCountChange(Math.min(cur.maxBatch, props.batchCount + 1))}>+</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
