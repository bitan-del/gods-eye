import { html } from "lit";
import type { SecurityFeatureDef } from "../controllers/security.ts";

export type SecurityProps = {
  features: SecurityFeatureDef[];
  featureStates: Record<string, boolean>;
  loading: boolean;
  saving: string | null;
  error: string | null;
  onToggle: (featureId: string, enabled: boolean) => void;
};

function renderFeatureCard(
  feature: SecurityFeatureDef,
  enabled: boolean,
  saving: boolean,
  props: SecurityProps,
): unknown {
  const isAlwaysOn = feature.configType === "always-on";
  return html`
    <div class="sec-card ${!enabled ? "sec-card-disabled" : ""}">
      <div class="sec-card-left">
        <div class="sec-card-icon" style="background:${feature.iconBg}">
          ${feature.icon}
        </div>
      </div>
      <div class="sec-card-center">
        <div class="sec-card-title-row">
          <h3 class="sec-card-title">${feature.title}</h3>
          <span
            class="sec-card-badge"
            style="background:${feature.badgeColor}15;color:${feature.badgeColor};border:1px solid ${feature.badgeColor}30"
          >
            ✓ ${feature.badge}
          </span>
          ${
            isAlwaysOn
              ? html`
                  <span class="sec-always-on">Always On</span>
                `
              : ""
          }
        </div>
        <p class="sec-card-desc">${feature.description}</p>
      </div>
      <div class="sec-card-right">
        <label class="sec-toggle ${isAlwaysOn ? "sec-toggle-locked" : ""}">
          <input
            type="checkbox"
            ?checked=${enabled}
            ?disabled=${isAlwaysOn || saving}
            @change=${(e: Event) => {
              if (!isAlwaysOn) {
                props.onToggle(feature.id, (e.target as HTMLInputElement).checked);
              }
            }}
          />
          <span class="sec-toggle-slider"></span>
        </label>
        ${
          saving
            ? html`
                <span class="sec-status sec-status-saving">Saving...</span>
              `
            : html`<span class="sec-status ${enabled ? "sec-status-active" : "sec-status-inactive"}">
                ${enabled ? "Active" : "Inactive"}
              </span>`
        }
      </div>
    </div>
  `;
}

export function renderSecurity(props: SecurityProps): unknown {
  const features = props.features;
  const activeCount = features.filter((f) => props.featureStates[f.id]).length;
  const totalCount = features.length;

  return html`
    <div class="sec-page">
      <div class="sec-page-header">
        <div class="sec-page-title-row">
          <h1 class="sec-page-title">Security</h1>
          <div class="sec-score">
            <span class="sec-score-num">${activeCount}/${totalCount}</span>
            <span class="sec-score-label">protections active</span>
          </div>
        </div>
        <p class="sec-page-subtitle">
          Defense-in-depth security layers protecting your agents, data, and environment.
        </p>
      </div>

      ${
        props.loading
          ? html`
              <div class="sec-status-banner sec-status-banner-loading">
                <span class="sec-status-banner-icon">⏳</span>
                Loading security status...
              </div>
            `
          : activeCount === totalCount
            ? html`
                <div class="sec-status-banner sec-status-banner-good">
                  <span class="sec-status-banner-icon">🛡️</span>
                  All security protections are active. Your system is fully protected.
                </div>
              `
            : html`
              <div class="sec-status-banner sec-status-banner-warn">
                <span class="sec-status-banner-icon">⚠️</span>
                ${totalCount - activeCount} protection${totalCount - activeCount > 1 ? "s" : ""} disabled. Review settings below.
              </div>
            `
      }

      ${props.error ? html`<div class="sec-error-banner">${props.error}</div>` : ""}

      <div class="sec-grid">
        ${features.map((f) =>
          renderFeatureCard(
            f,

            props.featureStates[f.id],
            props.saving === f.id,
            props,
          ),
        )}
      </div>

      <div class="sec-footer">
        <span class="sec-footer-icon">🛡️</span>
        Every operation you perform is under strict system protection
      </div>
    </div>
  `;
}
