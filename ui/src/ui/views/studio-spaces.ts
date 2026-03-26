// Studio Spaces — visual workflow builder for chaining creative operations.

import { html, nothing, type TemplateResult } from "lit";

// --- Types ---

export type WorkflowNodeType = "brand-scan" | "image-gen" | "video-gen" | "calendar";

export type WorkflowNode = {
  id: string;
  type: WorkflowNodeType;
  label: string;
  x: number;
  y: number;
  config: Record<string, string>;
};

export type WorkflowConnection = {
  fromId: string;
  toId: string;
};

export type WorkflowTemplate = {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
};

export type StudioSpacesProps = {
  connected: boolean;
  loading: boolean;
  running: boolean;
  error: string | null;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  selectedNodeId: string | null;
  runProgress: { currentNodeId: string | null; completedIds: string[] };
  onAddNode: (type: WorkflowNodeType) => void;
  onRemoveNode: (id: string) => void;
  onSelectNode: (id: string | null) => void;
  onMoveNode: (id: string, x: number, y: number) => void;
  onConnect: (fromId: string, toId: string) => void;
  onDisconnect: (fromId: string, toId: string) => void;
  onUpdateNodeConfig: (id: string, key: string, value: string) => void;
  onRun: () => void;
  onLoadTemplate: (template: WorkflowTemplate) => void;
  onBack: () => void;
};

// --- Constants ---

const NODE_META: Record<WorkflowNodeType, { icon: string; label: string; color: string }> = {
  "brand-scan": { icon: "\uD83C\uDFA8", label: "Brand Scan", color: "#8b5cf6" },
  "image-gen": { icon: "\uD83D\uDDBC\uFE0F", label: "Image Gen", color: "#3b82f6" },
  "video-gen": { icon: "\uD83C\uDFAC", label: "Video Gen", color: "#ef4444" },
  calendar: { icon: "\uD83D\uDCC5", label: "Calendar", color: "#10b981" },
};

const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "social-campaign",
    name: "Social Media Campaign",
    description: "Scan brand, generate hero image, create social variants, schedule posts.",
    nodes: [
      { id: "t1-brand", type: "brand-scan", label: "Scan Brand", x: 60, y: 120, config: {} },
      {
        id: "t1-hero",
        type: "image-gen",
        label: "Hero Image",
        x: 300,
        y: 60,
        config: { style: "photorealistic" },
      },
      {
        id: "t1-social",
        type: "image-gen",
        label: "Social Variants",
        x: 300,
        y: 200,
        config: { style: "flat-design" },
      },
      { id: "t1-schedule", type: "calendar", label: "Schedule Posts", x: 540, y: 120, config: {} },
    ],
    connections: [
      { fromId: "t1-brand", toId: "t1-hero" },
      { fromId: "t1-brand", toId: "t1-social" },
      { fromId: "t1-hero", toId: "t1-schedule" },
      { fromId: "t1-social", toId: "t1-schedule" },
    ],
  },
  {
    id: "brand-launch",
    name: "Brand Launch Kit",
    description: "Full brand scan, generate hero and promo video, then schedule launch.",
    nodes: [
      { id: "t2-brand", type: "brand-scan", label: "Scan Brand", x: 60, y: 120, config: {} },
      { id: "t2-hero", type: "image-gen", label: "Launch Hero", x: 300, y: 60, config: {} },
      { id: "t2-video", type: "video-gen", label: "Promo Video", x: 300, y: 200, config: {} },
      { id: "t2-cal", type: "calendar", label: "Launch Day", x: 540, y: 120, config: {} },
    ],
    connections: [
      { fromId: "t2-brand", toId: "t2-hero" },
      { fromId: "t2-brand", toId: "t2-video" },
      { fromId: "t2-hero", toId: "t2-cal" },
      { fromId: "t2-video", toId: "t2-cal" },
    ],
  },
  {
    id: "content-repurpose",
    name: "Content Repurpose",
    description: "Take brand context, generate an image, then turn it into a short video.",
    nodes: [
      { id: "t3-brand", type: "brand-scan", label: "Brand Context", x: 60, y: 120, config: {} },
      { id: "t3-img", type: "image-gen", label: "Still Image", x: 300, y: 120, config: {} },
      { id: "t3-vid", type: "video-gen", label: "Animated Short", x: 540, y: 120, config: {} },
    ],
    connections: [
      { fromId: "t3-brand", toId: "t3-img" },
      { fromId: "t3-img", toId: "t3-vid" },
    ],
  },
];

// --- SVG connection line helper ---

function renderConnectionSvg(
  nodes: WorkflowNode[],
  connections: WorkflowConnection[],
  runProgress: { currentNodeId: string | null; completedIds: string[] },
): TemplateResult {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  // Node card is roughly 160x72; connect center-right to center-left.
  const NODE_W = 160;
  const NODE_H = 72;

  const lines = connections
    .map((c) => {
      const from = nodeMap.get(c.fromId);
      const to = nodeMap.get(c.toId);
      if (!from || !to) {
        return "";
      }
      const x1 = from.x + NODE_W;
      const y1 = from.y + NODE_H / 2;
      const x2 = to.x;
      const y2 = to.y + NODE_H / 2;
      // Cubic bezier for a smooth curve
      const cx = (x1 + x2) / 2;
      const isActive =
        runProgress.completedIds.includes(c.fromId) && !runProgress.completedIds.includes(c.toId);
      const isDone =
        runProgress.completedIds.includes(c.fromId) && runProgress.completedIds.includes(c.toId);
      const color = isActive ? "#f59e0b" : isDone ? "#10b981" : "var(--text-3, #666)";
      return `<path d="M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}"
        stroke="${color}" stroke-width="2" fill="none" stroke-dasharray="${isActive ? "6 3" : "none"}"
        marker-end="url(#arrowhead)" />`;
    })
    .join("");

  // Raw SVG via unsafeHTML-equivalent pattern: build the full string and inject.
  // Lit's svg`` helper is for <svg> children; we need the outer <svg> wrapper.
  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:visible;">
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="var(--text-3, #666)" />
        </marker>
      </defs>
      ${lines}
    </svg>`;

  // We render as innerHTML because lit html`` escapes raw SVG strings.
  return html`<div .innerHTML=${svgContent}></div>`;
}

// --- Node card ---

function renderWorkflowNode(
  node: WorkflowNode,
  selected: boolean,
  runProgress: { currentNodeId: string | null; completedIds: string[] },
  onSelect: (id: string) => void,
  onRemove: (id: string) => void,
): TemplateResult {
  const meta = NODE_META[node.type];
  const isRunning = runProgress.currentNodeId === node.id;
  const isDone = runProgress.completedIds.includes(node.id);

  let borderColor = "var(--border-1, #333)";
  if (selected) {
    borderColor = meta.color;
  }
  if (isRunning) {
    borderColor = "#f59e0b";
  }
  if (isDone) {
    borderColor = "#10b981";
  }

  return html`
    <div
      style="
        position: absolute;
        left: ${node.x}px;
        top: ${node.y}px;
        width: 160px;
        padding: 12px;
        border-radius: 10px;
        background: var(--surface-2);
        border: 2px solid ${borderColor};
        cursor: pointer;
        user-select: none;
        transition: border-color 0.2s;
      "
      @click=${(e: Event) => {
        e.stopPropagation();
        onSelect(node.id);
      }}
    >
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 1.1em;">${meta.icon}</span>
        ${
          isDone
            ? html`
                <span style="color: #10b981; font-size: 0.8em">Done</span>
              `
            : isRunning
              ? html`
                  <span style="color: #f59e0b; font-size: 0.8em">Running...</span>
                `
              : nothing
        }
        <button
          class="btn btn-secondary btn-sm"
          style="padding: 0 4px; font-size: 0.7em; line-height: 1.4;"
          @click=${(e: Event) => {
            e.stopPropagation();
            onRemove(node.id);
          }}
        >x</button>
      </div>
      <div style="font-weight: 600; font-size: 0.85em; margin-top: 4px;">${node.label}</div>
      <div style="font-size: 0.7em; opacity: 0.5; margin-top: 2px;">${meta.label}</div>
    </div>
  `;
}

// --- Node config panel ---

function renderNodeConfig(
  node: WorkflowNode,
  onUpdate: (id: string, key: string, value: string) => void,
): TemplateResult {
  const meta = NODE_META[node.type];
  return html`
    <div style="padding: 16px; border-radius: 8px; background: var(--surface-2); margin-top: 16px;">
      <div style="font-weight: 600; margin-bottom: 8px;">${meta.icon} ${node.label} Config</div>
      <div style="display: grid; gap: 8px;">
        <div>
          <label class="field-label">Label</label>
          <input class="field-input" .value=${node.label}
            @input=${(e: Event) => onUpdate(node.id, "label", (e.target as HTMLInputElement).value)} />
        </div>
        ${
          node.type === "image-gen"
            ? html`
              <div>
                <label class="field-label">Style override</label>
                <input class="field-input" placeholder="e.g. photorealistic"
                  .value=${node.config.style ?? ""}
                  @input=${(e: Event) => onUpdate(node.id, "style", (e.target as HTMLInputElement).value)} />
              </div>
            `
            : nothing
        }
        ${
          node.type === "video-gen"
            ? html`
              <div>
                <label class="field-label">Duration (seconds)</label>
                <input class="field-input" type="number" placeholder="5"
                  .value=${node.config.duration ?? ""}
                  @input=${(e: Event) => onUpdate(node.id, "duration", (e.target as HTMLInputElement).value)} />
              </div>
            `
            : nothing
        }
        ${
          node.type === "brand-scan"
            ? html`
              <div>
                <label class="field-label">Source URL</label>
                <input class="field-input" placeholder="https://example.com"
                  .value=${node.config.source ?? ""}
                  @input=${(e: Event) => onUpdate(node.id, "source", (e.target as HTMLInputElement).value)} />
              </div>
            `
            : nothing
        }
        ${
          node.type === "calendar"
            ? html`
              <div>
                <label class="field-label">Schedule note</label>
                <input class="field-input" placeholder="Post at 9 AM EST"
                  .value=${node.config.note ?? ""}
                  @input=${(e: Event) => onUpdate(node.id, "note", (e.target as HTMLInputElement).value)} />
              </div>
            `
            : nothing
        }
      </div>
    </div>
  `;
}

// --- Main render ---

export function renderStudioSpaces(props: StudioSpacesProps): TemplateResult {
  const selectedNode = props.nodes.find((n) => n.id === props.selectedNodeId) ?? null;

  return html`
    <section class="card">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div class="card-title">Spaces Workflow Builder</div>
          <div class="card-subtitle">Chain creative operations into automated workflows.</div>
        </div>
        <button class="btn btn-secondary btn-sm" @click=${props.onBack}>Back to Gallery</button>
      </div>

      <!-- Templates -->
      <div style="margin-top: 16px;">
        <div style="font-weight: 600; font-size: 0.9em; margin-bottom: 8px;">Templates</div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          ${WORKFLOW_TEMPLATES.map(
            (tpl) => html`
              <button
                class="btn btn-secondary btn-sm"
                @click=${() => props.onLoadTemplate(tpl)}
                title=${tpl.description}
              >
                ${tpl.name}
              </button>
            `,
          )}
        </div>
      </div>

      <!-- Node palette -->
      <div style="margin-top: 16px;">
        <div style="font-weight: 600; font-size: 0.9em; margin-bottom: 8px;">Add Node</div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          ${(Object.keys(NODE_META) as WorkflowNodeType[]).map(
            (type) => html`
              <button
                class="btn btn-secondary btn-sm"
                style="border-left: 3px solid ${NODE_META[type].color};"
                @click=${() => props.onAddNode(type)}
              >
                ${NODE_META[type].icon} ${NODE_META[type].label}
              </button>
            `,
          )}
        </div>
      </div>

      <!-- Canvas -->
      <div
        style="
          position: relative;
          min-height: 400px;
          margin-top: 16px;
          border-radius: 8px;
          background: var(--surface-1, #1a1a1a);
          border: 1px solid var(--border-1, #333);
          overflow: auto;
        "
        @click=${() => props.onSelectNode(null)}
      >
        ${
          props.nodes.length === 0
            ? html`
                <div
                  style="
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0.4;
                    font-size: 0.9em;
                  "
                >
                  Add nodes or load a template to start building.
                </div>
              `
            : nothing
        }

        ${renderConnectionSvg(props.nodes, props.connections, props.runProgress)}
        ${props.nodes.map((node) =>
          renderWorkflowNode(
            node,
            node.id === props.selectedNodeId,
            props.runProgress,
            (id) => props.onSelectNode(id),
            (id) => props.onRemoveNode(id),
          ),
        )}
      </div>

      <!-- Connection helper: when a node is selected, offer connect buttons to others -->
      ${
        selectedNode && props.nodes.length > 1
          ? html`
            <div style="margin-top: 12px; font-size: 0.85em;">
              <span style="opacity: 0.6;">Connect "${selectedNode.label}" to:</span>
              <span style="display: inline-flex; gap: 4px; margin-left: 8px;">
                ${props.nodes
                  .filter((n) => n.id !== selectedNode.id)
                  .map((n) => {
                    const exists = props.connections.some(
                      (c) => c.fromId === selectedNode.id && c.toId === n.id,
                    );
                    return exists
                      ? html`<button class="btn btn-secondary btn-sm" style="opacity: 0.6;"
                          @click=${() => props.onDisconnect(selectedNode.id, n.id)}>${n.label} (linked)</button>`
                      : html`<button class="btn btn-secondary btn-sm"
                          @click=${() => props.onConnect(selectedNode.id, n.id)}>${n.label}</button>`;
                  })}
              </span>
            </div>
          `
          : nothing
      }

      <!-- Selected node config -->
      ${selectedNode ? renderNodeConfig(selectedNode, props.onUpdateNodeConfig) : nothing}

      ${props.error ? html`<div class="error-message" style="margin-top: 12px;">${props.error}</div>` : nothing}

      <!-- Run workflow -->
      <div style="margin-top: 16px; display: flex; gap: 12px; align-items: center;">
        <button
          class="btn btn-primary"
          ?disabled=${props.running || props.nodes.length === 0 || !props.connected}
          @click=${props.onRun}
        >
          ${props.running ? "Running Workflow..." : "Run Workflow"}
        </button>
        ${
          props.running
            ? html`<span style="font-size: 0.85em; opacity: 0.6;">
              ${props.runProgress.completedIds.length} / ${props.nodes.length} steps complete
            </span>`
            : html`<span style="font-size: 0.85em; opacity: 0.4;">${props.nodes.length} nodes, ${props.connections.length} connections</span>`
        }
      </div>
    </section>
  `;
}
