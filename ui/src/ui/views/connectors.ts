import { html, nothing } from "lit";
import {
  CONNECTOR_CATALOG,
  getConnectorStatus,
  type ConnectorDefinition,
  type ConnectorField,
} from "../controllers/connectors.ts";
import type { ChannelsStatusSnapshot } from "../types.ts";

export type ConnectorsProps = {
  loading: boolean;
  snapshot: ChannelsStatusSnapshot | null;
  error: string | null;
  search: string;
  configuring: string | null;
  formValues: Record<string, string>;
  formErrors: Record<string, string>;
  saving: boolean;
  saveError: string | null;
  validating: boolean;

  // WhatsApp QR flow
  whatsappBusy: boolean;
  whatsappQrDataUrl: string | null;
  whatsappMessage: string | null;
  whatsappConnected: boolean | null;

  onRefresh: () => void;
  onSearchChange: (value: string) => void;
  onConfigure: (connectorId: string) => void;
  onCloseConfig: () => void;
  onFieldChange: (key: string, value: string) => void;
  onSave: (connectorId: string) => void;
  onValidate: (connectorId: string) => void;
  onDisconnect: (connectorId: string) => void;

  // WhatsApp-specific
  onWhatsAppStart: (force: boolean) => void;
  onWhatsAppWait: () => void;
};

function connectorIcon(id: string, color: string): unknown {
  const iconMap: Record<string, string> = {
    telegram: "✈️",
    discord: "🎮",
    slack: "💼",
    whatsapp: "📱",
    signal: "🔒",
    msteams: "👥",
    matrix: "🌐",
    googlechat: "💬",
    irc: "📡",
    imessage: "🍎",
    line: "💚",
    nostr: "🟣",
    feishu: "🐦",
    mattermost: "💙",
    bluebubbles: "🫧",
    "nextcloud-talk": "☁️",
    "synology-chat": "🗄️",
  };
  const emoji = iconMap[id] ?? "🔌";
  return html`<span class="cn-card-icon" style="background:${color}20;color:${color}"
    >${emoji}</span
  >`;
}

function statusBadge(configured: boolean, connected: boolean, running: boolean): unknown {
  if (connected) {
    return html`
      <span class="cn-badge cn-badge-connected">Connected</span>
    `;
  }
  if (running) {
    return html`
      <span class="cn-badge cn-badge-running">Running</span>
    `;
  }
  if (configured) {
    return html`
      <span class="cn-badge cn-badge-configured">Configured</span>
    `;
  }
  return html`
    <span class="cn-badge cn-badge-idle">Not Connected</span>
  `;
}

function renderConnectorCard(def: ConnectorDefinition, props: ConnectorsProps): unknown {
  const status = getConnectorStatus(def.id, props.snapshot);
  const isConfiguredButNotConnected = status.configured && !status.connected;
  return html`
    <div class="cn-card">
      <div class="cn-card-header">
        ${connectorIcon(def.id, def.color)}
        ${statusBadge(status.configured, status.connected, status.running)}
      </div>
      <div class="cn-card-body">
        <h3 class="cn-card-title">${def.label}</h3>
        <p class="cn-card-desc">${def.description}</p>
      </div>
      <div class="cn-card-footer">
        ${
          status.connected
            ? html`
              <button
                class="cn-btn cn-btn-outline cn-btn-sm"
                @click=${() => props.onConfigure(def.id)}
              >
                Settings
              </button>
              <button
                class="cn-btn cn-btn-danger-outline cn-btn-sm"
                @click=${() => props.onDisconnect(def.id)}
              >
                Disconnect
              </button>
            `
            : isConfiguredButNotConnected
              ? html`
                <button
                  class="cn-btn cn-btn-connect cn-btn-sm"
                  @click=${() => {
                    props.onConfigure(def.id);
                    if (def.id === "whatsapp") {
                      props.onWhatsAppStart(false);
                    }
                  }}
                >
                  ${def.id === "whatsapp" ? "Link Device" : "Reconnect"}
                </button>
                <button
                  class="cn-btn cn-btn-outline cn-btn-sm"
                  @click=${() => props.onConfigure(def.id)}
                >
                  Settings
                </button>
                <button
                  class="cn-btn cn-btn-danger-outline cn-btn-sm"
                  @click=${() => props.onDisconnect(def.id)}
                >
                  Remove
                </button>
              `
              : html`
                <button
                  class="cn-btn cn-btn-connect"
                  @click=${() => {
                    props.onConfigure(def.id);
                    if (def.id === "whatsapp") {
                      props.onWhatsAppStart(false);
                    }
                  }}
                >
                  Connect
                </button>
              `
        }
      </div>
    </div>
  `;
}

function renderFieldInput(field: ConnectorField, props: ConnectorsProps): unknown {
  const value = props.formValues[field.key] ?? "";
  const error = props.formErrors[field.key] ?? "";
  const showPassword = false;

  // Select dropdown for fields with options
  if (field.options) {
    const selectedOption = field.options.find((o) => o.value === value);
    return html`
      <div class="cn-form-group">
        <label class="cn-form-label">
          ${field.label}
          ${
            field.required
              ? html`
                  <span class="cn-form-required">*</span>
                `
              : nothing
          }
        </label>
        <div class="cn-select-wrap">
          <select
            class="cn-form-select ${error ? "cn-form-input-error" : ""}"
            @change=${(e: Event) =>
              props.onFieldChange(field.key, (e.target as HTMLSelectElement).value)}
          >
            ${field.options.map(
              (opt) => html`
                <option value="${opt.value}" ?selected=${opt.value === value}>
                  ${opt.label}
                </option>
              `,
            )}
          </select>
        </div>
        ${
          selectedOption?.description
            ? html`<span class="cn-form-hint cn-form-hint-active">${selectedOption.description}</span>`
            : nothing
        }
        ${field.hint && !selectedOption?.description ? html`<span class="cn-form-hint">${field.hint}</span>` : nothing}
        ${error ? html`<span class="cn-form-error">${error}</span>` : nothing}
      </div>
    `;
  }

  // Textarea for multiline fields
  if (field.multiline) {
    return html`
      <div class="cn-form-group">
        <label class="cn-form-label">
          ${field.label}
          ${
            field.required
              ? html`
                  <span class="cn-form-required">*</span>
                `
              : nothing
          }
        </label>
        <textarea
          class="cn-form-textarea ${error ? "cn-form-input-error" : ""}"
          placeholder="${field.placeholder}"
          rows="3"
          .value=${value}
          @input=${(e: Event) =>
            props.onFieldChange(field.key, (e.target as HTMLTextAreaElement).value)}
        ></textarea>
        ${field.hint ? html`<span class="cn-form-hint">${field.hint}</span>` : nothing}
        ${error ? html`<span class="cn-form-error">${error}</span>` : nothing}
      </div>
    `;
  }

  // Default text/password input
  return html`
    <div class="cn-form-group">
      <label class="cn-form-label">
        ${field.label}
        ${
          field.required
            ? html`
                <span class="cn-form-required">*</span>
              `
            : nothing
        }
      </label>
      <div class="cn-form-input-wrap">
        <input
          class="cn-form-input ${error ? "cn-form-input-error" : ""}"
          type="${field.sensitive && !showPassword ? "password" : "text"}"
          placeholder="${field.placeholder}"
          .value=${value}
          @input=${(e: Event) =>
            props.onFieldChange(field.key, (e.target as HTMLInputElement).value)}
        />
        ${
          field.sensitive
            ? html`<button
              class="cn-form-toggle-vis"
              @click=${(e: Event) => {
                const input = (e.target as HTMLElement)
                  .closest(".cn-form-input-wrap")
                  ?.querySelector("input");
                if (input) {
                  input.type = input.type === "password" ? "text" : "password";
                }
              }}
            >
              👁
            </button>`
            : nothing
        }
      </div>
      ${field.hint ? html`<span class="cn-form-hint">${field.hint}</span>` : nothing}
      ${error ? html`<span class="cn-form-error">${error}</span>` : nothing}
    </div>
  `;
}

function renderConfigModal(def: ConnectorDefinition, props: ConnectorsProps): unknown {
  const isWhatsApp = def.id === "whatsapp";
  return html`
    <div class="cn-modal-backdrop" @click=${() => props.onCloseConfig()}>
      <div class="cn-modal" @click=${(e: Event) => e.stopPropagation()}>
        <div class="cn-modal-header">
          <div class="cn-modal-title-row">
            ${connectorIcon(def.id, def.color)}
            <h2 class="cn-modal-title">Configure ${def.label}</h2>
          </div>
          <button class="cn-modal-close" @click=${() => props.onCloseConfig()}>
            &times;
          </button>
        </div>

        <div class="cn-modal-subtitle">
          ${def.description}
        </div>

        <div class="cn-modal-body">
          ${
            def.setupSteps.length > 0
              ? html`
                <div class="cn-setup-steps">
                  <div class="cn-setup-steps-icon">🔑</div>
                  <ol class="cn-setup-steps-list">
                    ${def.setupSteps.map((step) => html`<li>${step}</li>`)}
                  </ol>
                  ${
                    def.guideUrl
                      ? html`<a
                        class="cn-setup-guide-link"
                        href="${def.guideUrl}"
                        target="_blank"
                        rel="noopener noreferrer"
                        >View Guide</a
                      >`
                      : nothing
                  }
                </div>
              `
              : nothing
          }

          ${isWhatsApp ? renderWhatsAppFlow(props) : nothing}

          ${def.fields.map((field) => renderFieldInput(field, props))}

          ${
            props.saveError
              ? html`<div class="cn-form-save-error">${props.saveError}</div>`
              : nothing
          }
        </div>

        <div class="cn-modal-footer">
          ${
            !isWhatsApp
              ? html`
                <button
                  class="cn-btn cn-btn-outline"
                  ?disabled=${props.validating}
                  @click=${() => props.onValidate(def.id)}
                >
                  ${props.validating ? "Validating..." : "Validate Config"}
                </button>
              `
              : nothing
          }
          <button
            class="cn-btn cn-btn-primary"
            ?disabled=${props.saving}
            @click=${() => props.onSave(def.id)}
          >
            ${props.saving ? "Saving..." : isWhatsApp ? "Save Settings" : "Save & Connect"}
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderWhatsAppFlow(props: ConnectorsProps): unknown {
  return html`
    <div class="cn-whatsapp-flow">
      ${
        props.whatsappQrDataUrl
          ? html`
            <div class="cn-whatsapp-qr">
              <img src="${props.whatsappQrDataUrl}" alt="WhatsApp QR Code" />
            </div>
            <div class="cn-whatsapp-actions">
              <button
                class="cn-btn cn-btn-primary"
                ?disabled=${props.whatsappBusy}
                @click=${() => props.onWhatsAppWait()}
              >
                ${props.whatsappBusy ? "Waiting..." : "I've Scanned the QR"}
              </button>
            </div>
          `
          : nothing
      }
      ${
        props.whatsappConnected === true
          ? html`
              <div class="cn-whatsapp-success">
                <span class="cn-whatsapp-check">&#10003;</span>
                WhatsApp connected successfully!
              </div>
            `
          : nothing
      }
      ${
        props.whatsappMessage && props.whatsappConnected !== true
          ? html`<div class="${props.whatsappConnected === false ? "cn-whatsapp-error" : "cn-whatsapp-info"}">${props.whatsappMessage}</div>`
          : nothing
      }
      ${
        !props.whatsappQrDataUrl && props.whatsappConnected !== true
          ? html`
            <button
              class="cn-btn cn-btn-primary cn-btn-block"
              ?disabled=${props.whatsappBusy}
              @click=${() => props.onWhatsAppStart(false)}
            >
              ${props.whatsappBusy ? "Generating QR..." : "Generate QR Code"}
            </button>
          `
          : nothing
      }
    </div>
  `;
}

export function renderConnectors(props: ConnectorsProps): unknown {
  const query = (props.search ?? "").toLowerCase().trim();
  const filtered = query
    ? CONNECTOR_CATALOG.filter(
        (c) => c.label.toLowerCase().includes(query) || c.description.toLowerCase().includes(query),
      )
    : CONNECTOR_CATALOG;

  const configuringDef = props.configuring
    ? CONNECTOR_CATALOG.find((c) => c.id === props.configuring)
    : null;

  return html`
    <div class="cn-page">
      <div class="cn-page-header">
        <div class="cn-page-title-row">
          <h1 class="cn-page-title">Connectors</h1>
          <button
            class="cn-btn cn-btn-outline cn-btn-sm"
            ?disabled=${props.loading}
            @click=${() => props.onRefresh()}
          >
            ${props.loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        <div class="cn-search-bar">
          <span class="cn-search-icon">&#128269;</span>
          <input
            class="cn-search-input"
            type="text"
            placeholder="Search Connectors"
            .value=${props.search ?? ""}
            @input=${(e: Event) => props.onSearchChange((e.target as HTMLInputElement).value)}
          />
        </div>
      </div>

      ${props.error ? html`<div class="cn-error-banner">${props.error}</div>` : nothing}

      <div class="cn-grid">
        ${filtered.map((def) => renderConnectorCard(def, props))}
      </div>

      ${
        filtered.length === 0
          ? html`
              <div class="cn-empty">
                <p>No connectors match your search.</p>
              </div>
            `
          : nothing
      }

      ${configuringDef ? renderConfigModal(configuringDef, props) : nothing}
    </div>
  `;
}
