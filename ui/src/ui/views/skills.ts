import { html, nothing } from "lit";
import type { SkillMessageMap, StoreSkillDetail, StoreSkillItem } from "../controllers/skills.ts";
import { clampText } from "../format.ts";
import { resolveSafeExternalUrl } from "../open-external-url.ts";
import type { SkillStatusEntry, SkillStatusReport } from "../types.ts";
import {
  computeSkillMissing,
  computeSkillReasons,
  renderSkillStatusChips,
} from "./skills-shared.ts";

function safeExternalHref(raw?: string): string | null {
  if (!raw) {
    return null;
  }
  return resolveSafeExternalUrl(raw, window.location.href);
}

export type SkillsStatusFilter = "all" | "ready" | "needs-setup" | "disabled";
export type StoreSort = "newest" | "downloads" | "name";

const STORE_CATEGORIES = [
  "All",
  "General",
  "Creative",
  "Academic",
  "Development",
  "Legal",
  "Lifestyle",
  "Marketing",
  "Finance",
] as const;

export type SkillsProps = {
  connected: boolean;
  loading: boolean;
  report: SkillStatusReport | null;
  error: string | null;
  filter: string;
  statusFilter: SkillsStatusFilter;
  edits: Record<string, string>;
  busyKey: string | null;
  messages: SkillMessageMap;
  detailKey: string | null;
  onFilterChange: (next: string) => void;
  onStatusFilterChange: (next: SkillsStatusFilter) => void;
  onRefresh: () => void;
  onToggle: (skillKey: string, enabled: boolean) => void;
  onEdit: (skillKey: string, value: string) => void;
  onSaveKey: (skillKey: string) => void;
  onInstall: (skillKey: string, name: string, installId: string) => void;
  onDetailOpen: (skillKey: string) => void;
  onDetailClose: () => void;
  // Store props
  viewTab: "my-skills" | "store";
  onViewTabChange: (tab: "my-skills" | "store") => void;
  storeItems: StoreSkillItem[];
  storeLoading: boolean;
  storeError: string | null;
  storeQuery: string;
  onStoreQueryChange: (query: string) => void;
  onStoreSearch: () => void;
  onStoreInstall: (slug: string) => void;
  storeDetailSlug: string | null;
  storeDetail: StoreSkillDetail | null;
  storeDetailLoading: boolean;
  onStoreDetailOpen: (slug: string) => void;
  onStoreDetailClose: () => void;
  // Sort & category
  storeSort: StoreSort;
  onStoreSortChange: (sort: StoreSort) => void;
  storeCategory: string;
  onStoreCategoryChange: (cat: string) => void;
  // Create
  createDropdownOpen: boolean;
  onCreateDropdownToggle: () => void;
  onCreateByChat: () => void;
  onCreateFromFile: () => void;
};

export function renderSkills(props: SkillsProps) {
  return html`
    <section class="sk-page">
      <div class="sk-header">
        <div class="sk-tabs-row">
          <button
            class="sk-tab ${props.viewTab === "store" ? "sk-tab--active" : ""}"
            @click=${() => props.onViewTabChange("store")}
          >Skill Store</button>
          <button
            class="sk-tab ${props.viewTab === "my-skills" ? "sk-tab--active" : ""}"
            @click=${() => props.onViewTabChange("my-skills")}
          >My Skills</button>
        </div>
        <div class="sk-header-right">
          <div class="sk-search-wrap">
            <input
              class="sk-search"
              type="text"
              placeholder="${props.viewTab === "store" ? "Search skills, press Enter" : "Search my skills..."}"
              .value=${props.viewTab === "store" ? props.storeQuery : props.filter}
              @input=${(e: Event) => {
                const val = (e.target as HTMLInputElement).value;
                if (props.viewTab === "store") {
                  props.onStoreQueryChange(val);
                } else {
                  props.onFilterChange(val);
                }
              }}
              @keydown=${(e: KeyboardEvent) => {
                if (e.key === "Enter" && props.viewTab === "store") {
                  props.onStoreSearch();
                }
              }}
            />
          </div>
          <div class="sk-create-wrap">
            <button class="sk-create-btn" @click=${props.onCreateDropdownToggle}>
              + Create Skill
            </button>
            ${
              props.createDropdownOpen
                ? html`
                  <div class="sk-create-dropdown">
                    <button class="sk-create-option" @click=${props.onCreateByChat}>
                      <span class="sk-create-option-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                      </span>
                      <div>
                        <div class="sk-create-option-title">Create by Chat</div>
                        <div class="sk-create-option-desc">Describe your needs, AI generates for you</div>
                      </div>
                    </button>
                    <button class="sk-create-option" @click=${props.onCreateFromFile}>
                      <span class="sk-create-option-icon sk-create-option-icon--purple">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      </span>
                      <div>
                        <div class="sk-create-option-title">Select Skill Package</div>
                        <div class="sk-create-option-desc">Select .zip or SKILL.md file directly</div>
                      </div>
                    </button>
                  </div>
                `
                : nothing
            }
          </div>
        </div>
      </div>

      ${props.viewTab === "my-skills" ? renderMySkills(props) : renderStore(props)}
    </section>
  `;
}

function renderMySkills(props: SkillsProps) {
  const skills = props.report?.skills ?? [];
  const filter = props.filter.trim().toLowerCase();
  const filtered = filter
    ? skills.filter((skill) =>
        [skill.name, skill.description, skill.source].join(" ").toLowerCase().includes(filter),
      )
    : skills;

  if (!props.connected && !props.report) {
    return html`
      <div class="sk-empty">Not connected to gateway.</div>
    `;
  }
  if (props.loading && filtered.length === 0) {
    return html`
      <div class="sk-empty">Loading skills...</div>
    `;
  }
  if (filtered.length === 0) {
    return html`
      <div class="sk-empty">No skills installed yet. Browse the Skill Store to get started.</div>
    `;
  }

  return html`
    <div class="sk-grid">
      ${filtered.map((skill) => renderMySkillCard(skill, props))}
    </div>
    ${props.detailKey ? renderSkillDetail(skills.find((s) => s.skillKey === props.detailKey) ?? null, props) : nothing}
  `;
}

function renderMySkillCard(skill: SkillStatusEntry, props: SkillsProps) {
  const busy = props.busyKey === skill.skillKey;

  return html`
    <div class="sk-card" @click=${() => props.onDetailOpen(skill.skillKey)}>
      <div class="sk-card-top">
        <div class="sk-card-icon">
          ${
            skill.emoji
              ? html`<span>${skill.emoji}</span>`
              : html`
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                `
          }
        </div>
        <label class="skill-toggle-wrap" @click=${(e: Event) => e.stopPropagation()}>
          <input
            type="checkbox"
            class="skill-toggle"
            .checked=${!skill.disabled}
            ?disabled=${busy}
            @change=${(e: Event) => {
              e.stopPropagation();
              props.onToggle(skill.skillKey, skill.disabled);
            }}
          />
        </label>
      </div>
      <div class="sk-card-name">${skill.name}</div>
      <div class="sk-card-desc">${clampText(skill.description, 80)}</div>
      <div class="sk-card-footer">
        <button
          class="sk-card-use-btn"
          @click=${(e: Event) => {
            e.stopPropagation();
            props.onDetailOpen(skill.skillKey);
          }}
        >Use Now</button>
        <button
          class="sk-card-delete-btn"
          title="Remove skill"
          @click=${(e: Event) => {
            e.stopPropagation();
            // Toggle disable as a soft remove
            props.onToggle(skill.skillKey, false);
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </button>
      </div>
    </div>
  `;
}

function renderStore(props: SkillsProps) {
  if (props.storeLoading && props.storeItems.length === 0) {
    return html`
      <div class="sk-empty">Loading store...</div>
    `;
  }
  if (props.storeError) {
    return html`<div class="sk-empty sk-empty--error">${props.storeError}</div>`;
  }
  if (props.storeItems.length === 0) {
    // Fall back to showing installed skills as store items when ClawHub is empty
    const installed = props.report?.skills ?? [];
    if (installed.length > 0) {
      return html`
        <div class="sk-store-info">Showing locally available skills. Community store coming soon.</div>
        <div class="sk-grid">
          ${installed.map(
            (skill) => html`
            <div class="sk-card" @click=${() => props.onDetailOpen(skill.skillKey)}>
              <div class="sk-card-top">
                <div class="sk-card-icon">
                  ${
                    skill.emoji
                      ? html`<span>${skill.emoji}</span>`
                      : html`
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
                          </svg>
                        `
                  }
                </div>
                <span class="sk-card-badge">Added</span>
              </div>
              <div class="sk-card-name">${skill.name}</div>
              <div class="sk-card-desc">${clampText(skill.description, 80)}</div>
              <div class="sk-card-footer">
                <button class="sk-card-use-btn" @click=${(e: Event) => {
                  e.stopPropagation();
                  props.onDetailOpen(skill.skillKey);
                }}>Use Now</button>
              </div>
            </div>
          `,
          )}
        </div>
        ${props.detailKey ? renderSkillDetail(installed.find((s) => s.skillKey === props.detailKey) ?? null, props) : nothing}
      `;
    }
    return html`
      <div class="sk-empty">No skills found in store. The community skill store is coming soon.</div>
    `;
  }

  // Category filter: match against slug + displayName + summary with expanded keywords
  const categoryKeywords: Record<string, string[]> = {
    general: [
      "general",
      "utility",
      "tool",
      "helper",
      "assistant",
      "agent",
      "monitor",
      "checker",
      "scanner",
    ],
    creative: [
      "creative",
      "image",
      "art",
      "design",
      "video",
      "photo",
      "music",
      "draw",
      "generation",
      "edit",
      "media",
    ],
    academic: [
      "academic",
      "research",
      "study",
      "paper",
      "science",
      "education",
      "learn",
      "university",
      "math",
    ],
    development: [
      "development",
      "code",
      "coding",
      "programming",
      "api",
      "debug",
      "git",
      "deploy",
      "devops",
      "cli",
      "sdk",
      "compiler",
      "docker",
      "kubernetes",
    ],
    legal: ["legal", "law", "compliance", "regulation", "contract", "privacy", "policy", "gdpr"],
    lifestyle: [
      "lifestyle",
      "health",
      "fitness",
      "recipe",
      "travel",
      "weather",
      "personal",
      "productivity",
    ],
    marketing: [
      "marketing",
      "seo",
      "ads",
      "campaign",
      "social",
      "content",
      "analytics",
      "brand",
      "email",
    ],
    finance: [
      "finance",
      "trading",
      "stock",
      "crypto",
      "investment",
      "budget",
      "accounting",
      "payment",
      "financial",
    ],
  };

  const catLower = props.storeCategory.toLowerCase();
  const keywords = categoryKeywords[catLower] ?? [];
  let filtered =
    catLower === "all"
      ? [...props.storeItems]
      : props.storeItems.filter((item) => {
          const text = `${item.slug} ${item.displayName} ${item.summary}`.toLowerCase();
          return keywords.some((kw) => text.includes(kw));
        });

  // Sort
  if (props.storeSort === "name") {
    filtered = [...filtered].toSorted((a, b) => a.displayName.localeCompare(b.displayName));
  } else if (props.storeSort === "downloads") {
    // Sort by score (search relevance) or updatedAt as proxy for popularity
    filtered = [...filtered].toSorted(
      (a, b) => (b.score ?? b.updatedAt ?? 0) - (a.score ?? a.updatedAt ?? 0),
    );
  }
  // "newest" keeps API order (already sorted by updatedAt desc)

  return html`
    <!-- Sort dropdown -->
    <div class="sk-sort-row">
      <div class="sk-categories">
        ${STORE_CATEGORIES.map(
          (cat) => html`
            <button
              class="sk-cat-tag ${props.storeCategory === cat ? "sk-cat-tag--active" : ""}"
              @click=${() => props.onStoreCategoryChange(cat)}
            >${cat}</button>
          `,
        )}
      </div>
      <select
        class="sk-sort-select"
        .value=${props.storeSort}
        @change=${(e: Event) => props.onStoreSortChange((e.target as HTMLSelectElement).value as StoreSort)}
      >
        <option value="newest">Newest</option>
        <option value="downloads">Most Downloaded</option>
        <option value="name">A-Z</option>
      </select>
    </div>
    <div class="sk-grid">
      ${filtered.map((item) => renderStoreCard(item, props))}
    </div>
    ${
      filtered.length === 0
        ? html`
            <div class="sk-empty">No skills found in this category.</div>
          `
        : nothing
    }
    ${props.storeDetailSlug ? renderStoreDetail(props.storeItems.find((i) => i.slug === props.storeDetailSlug) ?? null, props) : nothing}
  `;
}

function renderStoreCard(item: StoreSkillItem, props: SkillsProps) {
  const busy = props.busyKey === item.slug;
  // Check if already installed
  const installed = props.report?.skills.some(
    (s) => s.name.toLowerCase() === item.slug.toLowerCase() || s.skillKey.includes(item.slug),
  );

  return html`
    <div class="sk-card" @click=${() => props.onStoreDetailOpen(item.slug)}>
      <div class="sk-card-top">
        <div class="sk-card-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
        </div>
        ${
          installed
            ? html`
                <span class="sk-card-badge">Added</span>
              `
            : nothing
        }
      </div>
      <div class="sk-card-name">${item.displayName}</div>
      <div class="sk-card-desc">${clampText(item.summary, 80)}</div>
      ${item.owner ? html`<div class="sk-card-owner">by ${item.owner}</div>` : nothing}
      <div class="sk-card-footer">
        ${
          installed
            ? html`
                <button class="sk-card-use-btn sk-card-use-btn--installed" disabled>Installed</button>
              `
            : html`<button
                class="sk-card-use-btn"
                ?disabled=${busy}
                @click=${(e: Event) => {
                  e.stopPropagation();
                  props.onStoreInstall(item.slug);
                }}
              >${busy ? "Installing..." : "Use Now"}</button>`
        }
        <button
          class="sk-card-info-btn"
          title="View details"
          @click=${(e: Event) => {
            e.stopPropagation();
            props.onStoreDetailOpen(item.slug);
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        </button>
      </div>
    </div>
  `;
}

function formatNumber(n: number): string {
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}k`;
  }
  return String(n);
}

function formatDate(ts: number): string {
  if (!ts) {
    return "";
  }
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function renderStoreDetail(item: StoreSkillItem | null, props: SkillsProps) {
  if (!item) {
    return nothing;
  }
  const busy = props.busyKey === item.slug;
  const installed = props.report?.skills.some(
    (s) => s.name.toLowerCase() === item.slug.toLowerCase() || s.skillKey.includes(item.slug),
  );
  const detail = props.storeDetail;
  const loading = props.storeDetailLoading;

  return html`
    <dialog class="sk-detail-dialog" open @click=${(e: Event) => {
      if ((e.target as HTMLElement).classList.contains("sk-detail-dialog")) {
        props.onStoreDetailClose();
      }
    }}>
      <div class="sk-detail-panel">
        <button class="sk-detail-close" @click=${props.onStoreDetailClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>

        ${
          loading
            ? html`
                <div class="sk-detail-loading">Loading skill details...</div>
              `
            : html`
          <!-- Header with icon + name + author -->
          <div class="sk-detail-header">
            <div class="sk-detail-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            </div>
            <div class="sk-detail-header-text">
              <div class="sk-detail-name">${detail?.displayName ?? item.displayName}</div>
              ${
                detail?.owner?.handle
                  ? html`
                <div class="sk-detail-author">
                  ${detail.owner.image ? html`<img class="sk-detail-avatar" src="${detail.owner.image}" alt="" />` : nothing}
                  <span>by ${detail.owner.displayName || detail.owner.handle}</span>
                </div>
              `
                  : item.owner
                    ? html`<div class="sk-detail-author"><span>by ${item.owner}</span></div>`
                    : nothing
              }
            </div>
          </div>

          <!-- Stats row -->
          ${
            detail
              ? html`
            <div class="sk-detail-stats">
              ${
                detail.downloads
                  ? html`
                <div class="sk-detail-stat">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  <span>${formatNumber(detail.downloads)} downloads</span>
                </div>
              `
                  : nothing
              }
              ${
                detail.stars
                  ? html`
                <div class="sk-detail-stat">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  <span>${detail.stars} stars</span>
                </div>
              `
                  : nothing
              }
              ${
                detail.installs
                  ? html`
                <div class="sk-detail-stat">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  <span>${formatNumber(detail.installs)} active</span>
                </div>
              `
                  : nothing
              }
              ${
                detail.version
                  ? html`
                <div class="sk-detail-stat">
                  <span class="sk-detail-version-badge">v${detail.version}</span>
                </div>
              `
                  : nothing
              }
            </div>
          `
              : nothing
          }

          <!-- Description -->
          <div class="sk-detail-section">
            <div class="sk-detail-section-title">Description</div>
            <div class="sk-detail-desc">${detail?.summary ?? item.summary}</div>
          </div>

          <!-- Changelog -->
          ${
            detail?.changelog
              ? html`
            <div class="sk-detail-section">
              <div class="sk-detail-section-title">Changelog</div>
              <div class="sk-detail-changelog">${detail.changelog}</div>
            </div>
          `
              : nothing
          }

          <!-- Meta info -->
          ${
            detail
              ? html`
            <div class="sk-detail-meta">
              ${detail.license ? html`<span class="sk-detail-meta-item">License: ${detail.license}</span>` : nothing}
              ${detail.os.length > 0 ? html`<span class="sk-detail-meta-item">OS: ${detail.os.join(", ")}</span>` : nothing}
              ${detail.updatedAt ? html`<span class="sk-detail-meta-item">Updated: ${formatDate(detail.updatedAt)}</span>` : nothing}
            </div>
          `
              : nothing
          }

          <!-- Action button -->
          <div class="sk-detail-actions">
            ${
              installed
                ? html`
                    <button class="sk-detail-use-btn sk-detail-use-btn--installed" disabled>Already Installed</button>
                  `
                : html`<button
                    class="sk-detail-use-btn"
                    ?disabled=${busy}
                    @click=${() => props.onStoreInstall(item.slug)}
                  >${busy ? "Installing..." : "Install Skill"}</button>`
            }
          </div>
        `
        }
      </div>
    </dialog>
  `;
}

function renderSkillDetail(skill: SkillStatusEntry | null, props: SkillsProps) {
  if (!skill) {
    return nothing;
  }
  const busy = props.busyKey === skill.skillKey;
  const apiKey = props.edits[skill.skillKey] ?? "";
  const message = props.messages[skill.skillKey] ?? null;
  const canInstall = skill.install.length > 0 && skill.missing.bins.length > 0;
  const showBundledBadge = Boolean(skill.bundled && skill.source !== "godseye-bundled");
  const missing = computeSkillMissing(skill);
  const reasons = computeSkillReasons(skill);

  return html`
    <dialog class="sk-detail-dialog" open @click=${(e: Event) => {
      if ((e.target as HTMLElement).classList.contains("sk-detail-dialog")) {
        props.onDetailClose();
      }
    }}>
      <div class="sk-detail-panel">
        <button class="sk-detail-close" @click=${props.onDetailClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <div class="sk-detail-header">
          <div class="sk-detail-icon">
            ${
              skill.emoji
                ? html`<span style="font-size: 28px;">${skill.emoji}</span>`
                : html`
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                  `
            }
          </div>
          <div class="sk-detail-name">${skill.name}</div>
        </div>
        <div class="sk-detail-section">
          <div class="sk-detail-section-title">Skill Description</div>
          <div class="sk-detail-desc">${skill.description}</div>
          ${renderSkillStatusChips({ skill, showBundledBadge })}
        </div>

        ${
          missing.length > 0
            ? html`<div class="callout" style="border-color: var(--warn-subtle); background: var(--warn-subtle); color: var(--warn); margin: 0 0 12px;"><div style="font-weight: 600; margin-bottom: 4px;">Missing requirements</div><div>${missing.join(", ")}</div></div>`
            : nothing
        }

        ${
          reasons.length > 0
            ? html`<div class="muted" style="font-size: 13px; margin-bottom: 12px;">Reason: ${reasons.join(", ")}</div>`
            : nothing
        }

        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <label class="skill-toggle-wrap">
            <input type="checkbox" class="skill-toggle" .checked=${!skill.disabled} ?disabled=${busy} @change=${() => props.onToggle(skill.skillKey, skill.disabled)} />
          </label>
          <span style="font-size: 13px; font-weight: 500;">${skill.disabled ? "Disabled" : "Enabled"}</span>
          ${
            canInstall
              ? html`<button class="btn" ?disabled=${busy} @click=${() => props.onInstall(skill.skillKey, skill.name, skill.install[0].id)}>${busy ? "Installing\u2026" : skill.install[0].label}</button>`
              : nothing
          }
        </div>

        ${
          message
            ? html`<div class="callout ${message.kind === "error" ? "danger" : "success"}" style="margin-bottom: 12px;">${message.message}</div>`
            : nothing
        }

        ${
          skill.primaryEnv
            ? html`
              <div style="display: grid; gap: 8px; margin-bottom: 16px;">
                <div class="field">
                  <span>API key <span class="muted" style="font-weight: normal; font-size: 0.88em;">(${skill.primaryEnv})</span></span>
                  <input type="password" .value=${apiKey} @input=${(e: Event) => props.onEdit(skill.skillKey, (e.target as HTMLInputElement).value)} />
                </div>
                ${(() => {
                  const href = safeExternalHref(skill.homepage);
                  return href
                    ? html`<div class="muted" style="font-size: 13px;">Get your key: <a href="${href}" target="_blank" rel="noopener noreferrer">${skill.homepage}</a></div>`
                    : nothing;
                })()}
                <button class="btn primary" ?disabled=${busy} @click=${() => props.onSaveKey(skill.skillKey)}>Save key</button>
              </div>
            `
            : nothing
        }

        <div style="border-top: 1px solid var(--border); padding-top: 12px; display: grid; gap: 6px; font-size: 12px; color: var(--muted);">
          <div><span style="font-weight: 600;">Source:</span> ${skill.source}</div>
          <div style="font-family: var(--mono); word-break: break-all;">${skill.filePath}</div>
          ${(() => {
            const safeHref = safeExternalHref(skill.homepage);
            return safeHref
              ? html`<div><a href="${safeHref}" target="_blank" rel="noopener noreferrer">${skill.homepage}</a></div>`
              : nothing;
          })()}
        </div>
      </div>
    </dialog>
  `;
}
