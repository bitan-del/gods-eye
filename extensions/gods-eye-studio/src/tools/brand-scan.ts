// Brand Scan tool — analyze a website/URL/image to extract brand DNA.
// Stores brand profile in the brain so all future generations are brand-aware.

import { randomUUID } from "node:crypto";
import type { BrainMemory, BrandProfile } from "../brain/memory.js";

export interface BrandScanInput {
  /** URL to scan for brand identity, or description to parse. */
  source: string;
  name: string;
  /** Set as the active/default brand after scanning. */
  setAsDefault?: boolean;
}

export function buildBrandScanToolDef() {
  return {
    name: "studio_brand_scan",
    description: [
      "Scan a website URL or analyze a description to extract brand DNA.",
      "Extracts colors, tone, visual style, and fonts.",
      "The brand profile is saved to creative memory and can be set as the active brand.",
      "All future image/video generations will respect the active brand automatically.",
    ].join(" "),
    parameters: {
      type: "object" as const,
      properties: {
        source: {
          type: "string" as const,
          description: "URL to scan or text description of the brand to analyze.",
        },
        name: {
          type: "string" as const,
          description: "Brand name.",
        },
        setAsDefault: {
          type: "boolean" as const,
          description: "Set this as the active brand for all future generations.",
        },
      },
      required: ["source", "name"] as const,
    },
  };
}

/**
 * Save a scanned brand profile and optionally set it as active.
 */
export function saveBrandScanResult(
  brain: BrainMemory,
  input: BrandScanInput,
  extracted: Omit<BrandProfile, "id" | "name" | "createdAt" | "updatedAt">,
): BrandProfile {
  const now = new Date().toISOString();
  const brand: BrandProfile = {
    id: randomUUID(),
    name: input.name,
    ...extracted,
    createdAt: now,
    updatedAt: now,
  };

  brain.saveBrand(brand);

  if (input.setAsDefault !== false) {
    const prefs = brain.getPreferences();
    brain.savePreferences({ ...prefs, defaultBrandId: brand.id });
  }

  return brand;
}
