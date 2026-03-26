// Studio Brand view — brand profiles and DNA scanner.

import { html, nothing, type TemplateResult } from "lit";

export type StudioBrandProps = {
  connected: boolean;
  loading: boolean;
  scanning: boolean;
  error: string | null;
  scanSource: string;
  scanName: string;
  activeBrand: StudioBrandProfile | null;
  brands: StudioBrandProfile[];
  onScanSourceChange: (value: string) => void;
  onScanNameChange: (value: string) => void;
  onScan: () => void;
  onSetActive: (brandId: string) => void;
};

export type StudioBrandProfile = {
  id: string;
  name: string;
  colors: { primary: string; secondary: string; accent?: string };
  fonts?: { heading?: string; body?: string };
  tone?: string;
  visualStyle?: string;
  createdAt: string;
};

function renderColorSwatch(color: string): TemplateResult {
  return html`
    <span style="display: inline-flex; align-items: center; gap: 4px; margin-right: 8px;">
      <span style="display: inline-block; width: 16px; height: 16px; border-radius: 4px; background: ${color}; border: 1px solid var(--border);"></span>
      <code style="font-size: 0.8em;">${color}</code>
    </span>
  `;
}

function renderBrandCard(brand: StudioBrandProfile, isActive: boolean, onSetActive: (id: string) => void): TemplateResult {
  return html`
    <div style="padding: 16px; border-radius: 8px; background: var(--surface-2); margin-bottom: 12px; border: 2px solid ${isActive ? brand.colors.primary : "transparent"};">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <strong>${brand.name}</strong>
          ${isActive ? html`<span style="font-size: 0.8em; opacity: 0.7; margin-left: 8px;">(active)</span>` : nothing}
        </div>
        ${!isActive
          ? html`<button class="btn btn-secondary btn-sm" @click=${() => onSetActive(brand.id)}>Set Active</button>`
          : nothing}
      </div>
      <div style="margin-top: 8px;">
        ${renderColorSwatch(brand.colors.primary)}
        ${renderColorSwatch(brand.colors.secondary)}
        ${brand.colors.accent ? renderColorSwatch(brand.colors.accent) : nothing}
      </div>
      ${brand.tone ? html`<div style="font-size: 0.85em; opacity: 0.7; margin-top: 4px;">Tone: ${brand.tone}</div>` : nothing}
      ${brand.visualStyle ? html`<div style="font-size: 0.85em; opacity: 0.7;">Style: ${brand.visualStyle}</div>` : nothing}
      ${brand.fonts?.heading ? html`<div style="font-size: 0.85em; opacity: 0.7;">Fonts: ${brand.fonts.heading}${brand.fonts.body ? ` / ${brand.fonts.body}` : ""}</div>` : nothing}
    </div>
  `;
}

export function renderStudioBrand(props: StudioBrandProps): TemplateResult {
  return html`
    <section class="card">
      <div class="card-title">Brand Intelligence</div>
      <div class="card-subtitle">Scan websites to extract brand DNA. Active brand auto-applies to all generations.</div>

      <div style="display: grid; gap: 16px; margin-top: 16px;">
        <!-- Brand scanner -->
        <div style="padding: 16px; border-radius: 8px; background: var(--surface-2);">
          <div style="font-weight: 600; margin-bottom: 12px;">Brand Scanner</div>
          <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px;">
            <div>
              <label class="field-label">Website URL or description</label>
              <input type="text" class="field-input" placeholder="https://example.com or describe the brand..."
                .value=${props.scanSource}
                @input=${(e: Event) => props.onScanSourceChange((e.target as HTMLInputElement).value)} />
            </div>
            <div>
              <label class="field-label">Brand name</label>
              <input type="text" class="field-input" placeholder="My Brand"
                .value=${props.scanName}
                @input=${(e: Event) => props.onScanNameChange((e.target as HTMLInputElement).value)} />
            </div>
          </div>
          <button class="btn btn-primary" style="margin-top: 12px;"
            ?disabled=${props.scanning || !props.scanSource.trim() || !props.scanName.trim() || !props.connected}
            @click=${props.onScan}>
            ${props.scanning ? "Scanning..." : "Scan Brand DNA"}
          </button>
          ${props.error ? html`<div class="error-message" style="margin-top: 8px;">${props.error}</div>` : nothing}
        </div>

        <!-- Brand profiles -->
        <div>
          <div style="font-weight: 600; margin-bottom: 12px;">
            Brand Profiles ${props.brands.length > 0 ? html`<span style="opacity: 0.6;">(${props.brands.length})</span>` : nothing}
          </div>
          ${props.brands.length === 0
            ? html`<div style="opacity: 0.6; font-size: 0.9em;">No brands yet. Scan a website to create your first brand profile.</div>`
            : props.brands.map((brand) => renderBrandCard(brand, brand.id === props.activeBrand?.id, props.onSetActive))}
        </div>
      </div>
    </section>
  `;
}
