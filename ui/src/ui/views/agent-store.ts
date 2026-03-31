import { html, nothing } from "lit";
import type { AgentStoreEntry } from "../controllers/agent-store.ts";
import type { ModelCatalogEntry, SkillStatusReport } from "../types.ts";

const AVATAR_OPTIONS = [
  "🤖",
  "🧠",
  "🎯",
  "📝",
  "🔬",
  "💡",
  "🎨",
  "📊",
  "🛡️",
  "⚡",
  "🌐",
  "🔧",
  "📚",
  "🎭",
  "🚀",
  "💼",
  "🏗️",
  "🔍",
  "📈",
  "🎵",
];

export type AgentStoreProps = {
  connected: boolean;
  loading: boolean;
  error: string | null;
  agents: AgentStoreEntry[];
  search: string;
  sort: "newest" | "name" | "recent";
  showCreate: boolean;
  creating: boolean;
  createError: string | null;
  createName: string;
  createSummary: string;
  createRole: string;
  createModel: string;
  createSkills: string[];
  createAvatar: string;
  createModelSearch: string;
  createSkillSearch: string;
  createModelDropdownOpen: boolean;
  createSkillDropdownOpen: boolean;
  modelCatalog: ModelCatalogEntry[];
  skillsReport: SkillStatusReport | null;
  onSearchChange: (query: string) => void;
  onSortChange: (sort: "newest" | "name" | "recent") => void;
  onShowCreate: () => void;
  onCloseCreate: () => void;
  onCreateNameChange: (name: string) => void;
  onCreateSummaryChange: (summary: string) => void;
  onCreateRoleChange: (role: string) => void;
  onCreateModelChange: (model: string) => void;
  onCreateSkillsChange: (skills: string[]) => void;
  onCreateAvatarChange: (avatar: string) => void;
  onCreateModelSearchChange: (q: string) => void;
  onCreateSkillSearchChange: (q: string) => void;
  onCreateModelDropdownToggle: (open: boolean) => void;
  onCreateSkillDropdownToggle: (open: boolean) => void;
  onCreate: () => void;
  onAddAgent: (agentId: string) => void;
  onDeleteAgent: (agentId: string) => void;
};

function renderAgentCard(agent: AgentStoreEntry, props: AgentStoreProps) {
  const avatarDisplay = agent.avatar
    ? html`<img class="ag-card-avatar-img" src="${agent.avatar}" alt="${agent.name}" />`
    : html`<span class="ag-card-avatar-emoji">${agent.emoji || "🤖"}</span>`;

  return html`
    <div class="ag-card">
      <div class="ag-card-top">
        <div class="ag-card-avatar">${avatarDisplay}</div>
        <div class="ag-card-info">
          <div class="ag-card-name">${agent.name}</div>
          <div class="ag-card-desc">${agent.summary || "AI Agent"}</div>
        </div>
      </div>
      <div class="ag-card-footer">
        <button
          class="ag-card-add-btn"
          @click=${() => props.onAddAgent(agent.id)}
          title="Chat with agent"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Chat
        </button>
        <button
          class="ag-card-delete-btn"
          @click=${() => {
            if (window.confirm(`Remove agent "${agent.name}"?`)) {
              props.onDeleteAgent(agent.id);
            }
          }}
          title="Remove agent"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

function renderModelDropdown(props: AgentStoreProps) {
  const q = props.createModelSearch.toLowerCase();
  const filtered = props.modelCatalog.filter((m) => {
    if (!q) {
      return true;
    }
    return (
      (m.name || "").toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q) ||
      (m.provider || "").toLowerCase().includes(q)
    );
  });

  const selectedModel = props.modelCatalog.find((m) => m.id === props.createModel);
  const displayLabel = selectedModel
    ? `${selectedModel.name || selectedModel.id}${selectedModel.provider ? ` (${selectedModel.provider})` : ""}`
    : props.createModel || "Search and select a model...";

  return html`
    <div class="ag-dropdown-wrap">
      <div
        class="ag-dropdown-trigger ${props.createModelDropdownOpen ? "ag-dropdown-trigger--open" : ""}"
        @click=${() => props.onCreateModelDropdownToggle(!props.createModelDropdownOpen)}
      >
        <span class="ag-dropdown-trigger-text ${!props.createModel ? "ag-dropdown-placeholder" : ""}">
          ${displayLabel}
        </span>
        <svg class="ag-dropdown-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </div>
      ${
        props.createModelDropdownOpen
          ? html`
            <div class="ag-dropdown-panel">
              <div class="ag-dropdown-search-wrap">
                <svg class="ag-dropdown-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  class="ag-dropdown-search"
                  type="text"
                  placeholder="Search models..."
                  .value=${props.createModelSearch}
                  @input=${(e: Event) => props.onCreateModelSearchChange((e.target as HTMLInputElement).value)}
                  @click=${(e: Event) => e.stopPropagation()}
                />
              </div>
              <div class="ag-dropdown-list">
                <div
                  class="ag-dropdown-item ${!props.createModel ? "ag-dropdown-item--active" : ""}"
                  @click=${() => {
                    props.onCreateModelChange("");
                    props.onCreateModelDropdownToggle(false);
                    props.onCreateModelSearchChange("");
                  }}
                >
                  <span class="ag-dropdown-item-name">Default model</span>
                </div>
                ${filtered.map(
                  (m) => html`
                    <div
                      class="ag-dropdown-item ${props.createModel === m.id ? "ag-dropdown-item--active" : ""}"
                      @click=${() => {
                        props.onCreateModelChange(m.id);
                        props.onCreateModelDropdownToggle(false);
                        props.onCreateModelSearchChange("");
                      }}
                    >
                      <span class="ag-dropdown-item-name">${m.name || m.id}</span>
                      ${m.provider ? html`<span class="ag-dropdown-item-badge">${m.provider}</span>` : nothing}
                    </div>
                  `,
                )}
                ${
                  filtered.length === 0
                    ? html`
                        <div class="ag-dropdown-empty">No models match</div>
                      `
                    : nothing
                }
              </div>
            </div>
          `
          : nothing
      }
    </div>
  `;
}

function renderSkillDropdown(
  props: AgentStoreProps,
  availableSkills: Array<{ key: string; name: string; emoji?: string }>,
) {
  const q = props.createSkillSearch.toLowerCase();
  const filtered = availableSkills.filter((s) => {
    if (!q) {
      return true;
    }
    return s.name.toLowerCase().includes(q) || s.key.toLowerCase().includes(q);
  });

  const selectedCount = props.createSkills.length;
  const displayLabel =
    selectedCount > 0
      ? `${selectedCount} skill${selectedCount > 1 ? "s" : ""} selected`
      : "Search and select skills...";

  return html`
    <div class="ag-dropdown-wrap">
      <div
        class="ag-dropdown-trigger ${props.createSkillDropdownOpen ? "ag-dropdown-trigger--open" : ""}"
        @click=${() => props.onCreateSkillDropdownToggle(!props.createSkillDropdownOpen)}
      >
        <span class="ag-dropdown-trigger-text ${selectedCount === 0 ? "ag-dropdown-placeholder" : ""}">
          ${displayLabel}
        </span>
        <svg class="ag-dropdown-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </div>
      ${
        props.createSkillDropdownOpen
          ? html`
            <div class="ag-dropdown-panel">
              <div class="ag-dropdown-search-wrap">
                <svg class="ag-dropdown-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  class="ag-dropdown-search"
                  type="text"
                  placeholder="Search skills..."
                  .value=${props.createSkillSearch}
                  @input=${(e: Event) => props.onCreateSkillSearchChange((e.target as HTMLInputElement).value)}
                  @click=${(e: Event) => e.stopPropagation()}
                />
              </div>
              <div class="ag-dropdown-list">
                ${filtered.map((skill) => {
                  const isSelected = props.createSkills.includes(skill.key);
                  return html`
                      <div
                        class="ag-dropdown-item ag-dropdown-item--check ${isSelected ? "ag-dropdown-item--active" : ""}"
                        @click=${(e: Event) => {
                          e.stopPropagation();
                          if (isSelected) {
                            props.onCreateSkillsChange(
                              props.createSkills.filter((s) => s !== skill.key),
                            );
                          } else {
                            props.onCreateSkillsChange([...props.createSkills, skill.key]);
                          }
                        }}
                      >
                        <span class="ag-dropdown-check">
                          ${
                            isSelected
                              ? html`
                                  <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2.5"
                                  >
                                    <path d="M20 6L9 17l-5-5" />
                                  </svg>
                                `
                              : nothing
                          }
                        </span>
                        ${skill.emoji ? html`<span class="ag-skill-emoji">${skill.emoji}</span>` : nothing}
                        <span class="ag-dropdown-item-name">${skill.name}</span>
                      </div>
                    `;
                })}
                ${
                  filtered.length === 0
                    ? html`
                        <div class="ag-dropdown-empty">No skills match</div>
                      `
                    : nothing
                }
              </div>
            </div>
          `
          : nothing
      }
    </div>
    ${
      props.createSkills.length > 0
        ? html`
          <div class="ag-selected-skills">
            ${props.createSkills.map((key) => {
              const skill = availableSkills.find((s) => s.key === key);
              return html`
                <span class="ag-selected-skill-tag">
                  ${skill?.emoji ? html`<span class="ag-skill-emoji">${skill.emoji}</span>` : nothing}
                  ${skill?.name ?? key}
                  <button
                    class="ag-selected-skill-remove"
                    @click=${() => props.onCreateSkillsChange(props.createSkills.filter((s) => s !== key))}
                  >×</button>
                </span>
              `;
            })}
          </div>
        `
        : nothing
    }
  `;
}

function renderCreateModal(props: AgentStoreProps) {
  if (!props.showCreate) {
    return nothing;
  }

  const availableSkills: Array<{ key: string; name: string; emoji?: string }> = [];
  if (props.skillsReport?.skills) {
    for (const skill of props.skillsReport.skills) {
      if (skill && !skill.disabled) {
        availableSkills.push({
          key: skill.skillKey,
          name: skill.name || skill.skillKey,
          emoji: skill.emoji,
        });
      }
    }
  }

  return html`
    <div class="ag-modal-backdrop" @click=${(e: Event) => {
      if ((e.target as HTMLElement).classList.contains("ag-modal-backdrop")) {
        props.onCloseCreate();
      }
    }}>
      <div class="ag-modal" @click=${() => {
        // Close dropdowns when clicking elsewhere in modal
        if (props.createModelDropdownOpen) {
          props.onCreateModelDropdownToggle(false);
        }
        if (props.createSkillDropdownOpen) {
          props.onCreateSkillDropdownToggle(false);
        }
      }}>
        <div class="ag-modal-header">
          <h2 class="ag-modal-title">Create Agent</h2>
          <button class="ag-modal-close" @click=${props.onCloseCreate}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18"/><path d="M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="ag-modal-body">
          <!-- Avatar Picker -->
          <div class="ag-form-group">
            <label class="ag-form-label">Avatar</label>
            <div class="ag-avatar-picker">
              ${AVATAR_OPTIONS.map(
                (emoji) => html`
                  <button
                    class="ag-avatar-option ${props.createAvatar === emoji ? "ag-avatar-option--active" : ""}"
                    @click=${() => props.onCreateAvatarChange(emoji)}
                  >
                    ${emoji}
                  </button>
                `,
              )}
            </div>
          </div>

          <!-- Agent Name -->
          <div class="ag-form-group">
            <label class="ag-form-label">Agent Name <span class="ag-form-required">*</span></label>
            <input
              class="ag-form-input"
              type="text"
              placeholder="e.g. Research Agent"
              maxlength="20"
              .value=${props.createName}
              @input=${(e: Event) => props.onCreateNameChange((e.target as HTMLInputElement).value)}
            />
            <span class="ag-form-hint">${props.createName.length}/20 characters</span>
          </div>

          <!-- One-line Summary -->
          <div class="ag-form-group">
            <label class="ag-form-label">One-line Summary</label>
            <input
              class="ag-form-input"
              type="text"
              placeholder="e.g. Researches topics and provides detailed analysis"
              maxlength="100"
              .value=${props.createSummary}
              @input=${(e: Event) => props.onCreateSummaryChange((e.target as HTMLInputElement).value)}
            />
            <span class="ag-form-hint">${props.createSummary.length}/100 characters</span>
          </div>

          <!-- Role Definition & Strategy -->
          <div class="ag-form-group">
            <label class="ag-form-label">Role Definition & Strategy</label>
            <textarea
              class="ag-form-textarea"
              placeholder="Define the agent's role, personality, and strategy..."
              rows="4"
              .value=${props.createRole}
              @input=${(e: Event) => props.onCreateRoleChange((e.target as HTMLTextAreaElement).value)}
            ></textarea>
          </div>

          <!-- Select Model (searchable dropdown) -->
          <div class="ag-form-group" @click=${(e: Event) => e.stopPropagation()}>
            <label class="ag-form-label">Select Model</label>
            ${renderModelDropdown(props)}
          </div>

          <!-- Skills (searchable multi-select dropdown) -->
          <div class="ag-form-group" @click=${(e: Event) => e.stopPropagation()}>
            <label class="ag-form-label">Skills <span class="ag-form-optional">(optional)</span></label>
            ${
              availableSkills.length > 0
                ? renderSkillDropdown(props, availableSkills)
                : html`
                    <span class="ag-form-hint">No skills available. Install skills from the Skills tab first.</span>
                  `
            }
          </div>

          ${
            props.createError
              ? html`<div class="ag-form-error">${props.createError}</div>`
              : nothing
          }
        </div>

        <div class="ag-modal-footer">
          <button class="ag-btn ag-btn--secondary" @click=${props.onCloseCreate}>Cancel</button>
          <button
            class="ag-btn ag-btn--primary"
            ?disabled=${!props.createName.trim() || props.creating}
            @click=${props.onCreate}
          >
            ${props.creating ? "Creating..." : "Create Agent"}
          </button>
        </div>
      </div>
    </div>
  `;
}

export function renderAgentStore(props: AgentStoreProps) {
  const filtered = props.agents.filter((agent) => {
    if (!props.search.trim()) {
      return true;
    }
    const q = props.search.toLowerCase();
    return (
      agent.name.toLowerCase().includes(q) ||
      (agent.summary ?? "").toLowerCase().includes(q) ||
      agent.id.toLowerCase().includes(q)
    );
  });

  const sorted = [...filtered].toSorted((a, b) => {
    if (props.sort === "name") {
      return a.name.localeCompare(b.name);
    }
    return b.id.localeCompare(a.id);
  });

  return html`
    <section class="ag-page">
      <div class="ag-header">
        <div class="ag-header-left">
          <h1 class="ag-title">Agent Store</h1>
          <span class="ag-subtitle">Create and manage your AI agents</span>
        </div>
        <div class="ag-header-right">
          <button class="ag-create-btn" @click=${props.onShowCreate}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14"/><path d="M5 12h14"/>
            </svg>
            Create Agent
          </button>
        </div>
      </div>

      <div class="ag-toolbar">
        <div class="ag-search-wrap">
          <svg class="ag-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            class="ag-search"
            type="text"
            placeholder="Search agents..."
            .value=${props.search}
            @input=${(e: Event) => props.onSearchChange((e.target as HTMLInputElement).value)}
          />
        </div>
        <select
          class="ag-sort-select"
          .value=${props.sort}
          @change=${(e: Event) => props.onSortChange((e.target as HTMLSelectElement).value as "newest" | "name" | "recent")}
        >
          <option value="newest">Newest</option>
          <option value="name">A-Z</option>
          <option value="recent">Recent</option>
        </select>
      </div>

      ${
        props.loading
          ? html`
              <div class="ag-loading">Loading agents...</div>
            `
          : sorted.length === 0
            ? html`
              <div class="ag-empty">
                <div class="ag-empty-icon">🤖</div>
                <h3>No agents yet</h3>
                <p>Create your first AI agent to get started</p>
                <button class="ag-btn ag-btn--primary" @click=${props.onShowCreate}>
                  Create Agent
                </button>
              </div>
            `
            : html`
              <div class="ag-grid">
                ${sorted.map((agent) => renderAgentCard(agent, props))}
              </div>
            `
      }

      ${props.error ? html`<div class="ag-error">${props.error}</div>` : nothing}

      ${renderCreateModal(props)}
    </section>
  `;
}
