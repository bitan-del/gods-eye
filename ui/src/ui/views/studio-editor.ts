// Studio Editor — simple canvas-based image markup and annotation tool.

import { html, nothing, type TemplateResult } from "lit";

// --- Types ---

export type EditorTool = "pencil" | "text" | "rectangle" | "circle" | "arrow";

export type EditorAnnotation = {
  id: string;
  tool: EditorTool;
  color: string;
  strokeWidth: number;
  // Pencil: array of points; shapes: start + end point; text: single point + content.
  points: Array<{ x: number; y: number }>;
  textContent?: string;
};

export type StudioEditorProps = {
  connected: boolean;
  loading: boolean;
  error: string | null;
  /** Base64 data URL or asset URL of the image being edited. null = blank canvas. */
  imageUrl: string | null;
  activeTool: EditorTool;
  activeColor: string;
  strokeWidth: number;
  annotations: EditorAnnotation[];
  brandColors: string[];
  canvasWidth: number;
  canvasHeight: number;
  onToolChange: (tool: EditorTool) => void;
  onColorChange: (color: string) => void;
  onStrokeWidthChange: (width: number) => void;
  onAddAnnotation: (annotation: EditorAnnotation) => void;
  onUndoAnnotation: () => void;
  onClearAnnotations: () => void;
  onExport: () => void;
  onSendToImageGen: () => void;
  onBack: () => void;
};

// --- Constants ---

const TOOLS: Array<{ id: EditorTool; icon: string; label: string }> = [
  { id: "pencil", icon: "\u270F\uFE0F", label: "Pencil" },
  { id: "text", icon: "\uD83C\uDDE6", label: "Text" },
  { id: "rectangle", icon: "\u25A1", label: "Rectangle" },
  { id: "circle", icon: "\u25CB", label: "Circle" },
  { id: "arrow", icon: "\u2192", label: "Arrow" },
];

const DEFAULT_COLORS = ["#000000", "#ffffff", "#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"];

// --- SVG annotation rendering ---
// Builds an SVG overlay string representing all annotations on the canvas.

function annotationToSvg(ann: EditorAnnotation): string {
  const c = ann.color;
  const sw = ann.strokeWidth;

  switch (ann.tool) {
    case "pencil": {
      if (ann.points.length < 2) return "";
      const d = ann.points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
      return `<path d="${d}" stroke="${c}" stroke-width="${sw}" fill="none" stroke-linecap="round" stroke-linejoin="round" />`;
    }
    case "rectangle": {
      if (ann.points.length < 2) return "";
      const [p0, p1] = ann.points;
      const x = Math.min(p0.x, p1.x);
      const y = Math.min(p0.y, p1.y);
      const w = Math.abs(p1.x - p0.x);
      const h = Math.abs(p1.y - p0.y);
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" stroke="${c}" stroke-width="${sw}" fill="none" />`;
    }
    case "circle": {
      if (ann.points.length < 2) return "";
      const [p0, p1] = ann.points;
      const cx = (p0.x + p1.x) / 2;
      const cy = (p0.y + p1.y) / 2;
      const rx = Math.abs(p1.x - p0.x) / 2;
      const ry = Math.abs(p1.y - p0.y) / 2;
      return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" stroke="${c}" stroke-width="${sw}" fill="none" />`;
    }
    case "arrow": {
      if (ann.points.length < 2) return "";
      const [p0, p1] = ann.points;
      // Line with arrowhead
      const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
      const headLen = 12;
      const ax1 = p1.x - headLen * Math.cos(angle - Math.PI / 6);
      const ay1 = p1.y - headLen * Math.sin(angle - Math.PI / 6);
      const ax2 = p1.x - headLen * Math.cos(angle + Math.PI / 6);
      const ay2 = p1.y - headLen * Math.sin(angle + Math.PI / 6);
      return `<line x1="${p0.x}" y1="${p0.y}" x2="${p1.x}" y2="${p1.y}" stroke="${c}" stroke-width="${sw}" />
        <polygon points="${p1.x},${p1.y} ${ax1},${ay1} ${ax2},${ay2}" fill="${c}" />`;
    }
    case "text": {
      if (ann.points.length < 1 || !ann.textContent) return "";
      const p = ann.points[0];
      return `<text x="${p.x}" y="${p.y}" fill="${c}" font-size="${14 + sw * 2}px" font-family="sans-serif">${escapeXml(ann.textContent)}</text>`;
    }
    default:
      return "";
  }
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildAnnotationsSvg(annotations: EditorAnnotation[], width: number, height: number): string {
  const inner = annotations.map(annotationToSvg).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" style="position:absolute;top:0;left:0;pointer-events:none;">${inner}</svg>`;
}

// --- Main render ---

export function renderStudioEditor(props: StudioEditorProps): TemplateResult {
  const allColors = [...new Set([...props.brandColors, ...DEFAULT_COLORS])];
  const svgOverlay = buildAnnotationsSvg(props.annotations, props.canvasWidth, props.canvasHeight);

  return html`
    <section class="card">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div class="card-title">Editor</div>
          <div class="card-subtitle">Annotate and mark up images. Sketch ideas for generation.</div>
        </div>
        <button class="btn btn-secondary btn-sm" @click=${props.onBack}>Back to Gallery</button>
      </div>

      <!-- Toolbar -->
      <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 16px; padding: 8px 12px; border-radius: 8px; background: var(--surface-2);">
        <!-- Tool buttons -->
        ${TOOLS.map(
          (t) => html`
            <button
              class="btn ${props.activeTool === t.id ? "btn-primary" : "btn-secondary"} btn-sm"
              @click=${() => props.onToolChange(t.id)}
              title=${t.label}
            >
              ${t.icon} ${t.label}
            </button>
          `,
        )}

        <span style="width: 1px; height: 24px; background: var(--border-1, #333); margin: 0 4px;"></span>

        <!-- Color picker -->
        <div style="display: flex; gap: 3px; align-items: center;">
          ${allColors.map(
            (c) => html`
              <button
                style="
                  width: 20px; height: 20px; border-radius: 50%;
                  background: ${c};
                  border: 2px solid ${c === props.activeColor ? "var(--text-1, #fff)" : "transparent"};
                  cursor: pointer;
                "
                @click=${() => props.onColorChange(c)}
                title=${c}
              ></button>
            `,
          )}
        </div>

        <span style="width: 1px; height: 24px; background: var(--border-1, #333); margin: 0 4px;"></span>

        <!-- Stroke width -->
        <label style="font-size: 0.8em; opacity: 0.6;">Width:</label>
        <input
          type="range" min="1" max="10" .value=${String(props.strokeWidth)}
          style="width: 80px;"
          @input=${(e: Event) => props.onStrokeWidthChange(Number((e.target as HTMLInputElement).value))}
        />
        <span style="font-size: 0.8em; min-width: 20px;">${props.strokeWidth}px</span>
      </div>

      <!-- Canvas area -->
      <div
        style="
          position: relative;
          width: ${props.canvasWidth}px;
          max-width: 100%;
          height: ${props.canvasHeight}px;
          margin-top: 12px;
          border-radius: 8px;
          background: var(--surface-1, #1a1a1a);
          border: 1px solid var(--border-1, #333);
          overflow: hidden;
        "
      >
        ${props.imageUrl
          ? html`<img
              src=${props.imageUrl}
              style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain;"
              alt="Base image"
            />`
          : html`<div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; opacity: 0.3; font-size: 0.9em;">
              Blank canvas. Sketch something or load an image from Gallery.
            </div>`}

        <!-- SVG annotation overlay -->
        <div .innerHTML=${svgOverlay}></div>

        <!-- Interaction layer: a transparent div that captures mouse/pointer events.
             The parent component should wire mousedown/mousemove/mouseup to onAddAnnotation. -->
        <div
          style="position: absolute; inset: 0; cursor: crosshair;"
          data-editor-interaction-layer="true"
        ></div>
      </div>

      ${props.error ? html`<div class="error-message" style="margin-top: 12px;">${props.error}</div>` : nothing}

      <!-- Action bar -->
      <div style="display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap;">
        <button class="btn btn-secondary btn-sm" @click=${props.onUndoAnnotation}
          ?disabled=${props.annotations.length === 0}>Undo</button>
        <button class="btn btn-secondary btn-sm" @click=${props.onClearAnnotations}
          ?disabled=${props.annotations.length === 0}>Clear All</button>
        <span style="flex: 1;"></span>
        <button class="btn btn-secondary btn-sm" @click=${props.onExport}>Export Image</button>
        <button class="btn btn-primary btn-sm" @click=${props.onSendToImageGen}
          ?disabled=${!props.connected}>Send to Image Gen</button>
      </div>

      <div style="font-size: 0.8em; opacity: 0.4; margin-top: 8px;">
        ${props.annotations.length} annotation${props.annotations.length === 1 ? "" : "s"}
        ${props.brandColors.length > 0 ? " | Brand colors loaded" : ""}
      </div>
    </section>
  `;
}
