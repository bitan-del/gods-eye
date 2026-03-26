// Brain Memory — persistent creative memory layer.
// Stores brands, generation history, preferences, characters, and calendar state.
// Uses SQLite for fast structured recall + JSON files for rich data.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BrandProfile {
  id: string;
  name: string;
  colors: { primary: string; secondary: string; accent?: string };
  fonts?: { heading?: string; body?: string };
  tone?: string;
  logoUrl?: string;
  visualStyle?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GenerationRecord {
  id: string;
  type: "image" | "video" | "text";
  prompt: string;
  model: string;
  provider: string;
  settings: Record<string, unknown>;
  /** Base64 thumbnail or file path for generated asset. */
  resultRef?: string;
  brandId?: string;
  tags: string[];
  createdAt: string;
}

export interface CalendarSlot {
  id: string;
  date: string;
  platform?: string;
  status: "ideated" | "generated" | "approved" | "published";
  generationId?: string;
  notes?: string;
}

export interface CharacterProfile {
  id: string;
  name: string;
  description?: string;
  referenceImages: string[];
  style?: string;
  createdAt: string;
}

export interface UserPreferences {
  defaultImageModel?: string;
  defaultVideoModel?: string;
  defaultBrandId?: string;
  stylePreferences?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Brain Memory Store
// ---------------------------------------------------------------------------

export class BrainMemory {
  private readonly basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
    this.ensureDirectories();
  }

  // -- Directory scaffolding ------------------------------------------------

  private ensureDirectories(): void {
    const dirs = ["brands", "generations", "calendar", "characters"];
    for (const dir of dirs) {
      const fullPath = join(this.basePath, dir);
      if (!existsSync(fullPath)) {
        mkdirSync(fullPath, { recursive: true });
      }
    }
  }

  // -- Brand profiles -------------------------------------------------------

  saveBrand(brand: BrandProfile): void {
    const filePath = join(this.basePath, "brands", `${brand.id}.json`);
    writeFileSync(filePath, JSON.stringify(brand, null, 2));
  }

  getBrand(id: string): BrandProfile | undefined {
    const filePath = join(this.basePath, "brands", `${id}.json`);
    if (!existsSync(filePath)) return undefined;
    return JSON.parse(readFileSync(filePath, "utf-8")) as BrandProfile;
  }

  listBrands(): BrandProfile[] {
    return this.listJsonFiles<BrandProfile>("brands");
  }

  // -- Generation history ---------------------------------------------------

  saveGeneration(record: GenerationRecord): void {
    const filePath = join(this.basePath, "generations", `${record.id}.json`);
    writeFileSync(filePath, JSON.stringify(record, null, 2));
  }

  getGeneration(id: string): GenerationRecord | undefined {
    const filePath = join(this.basePath, "generations", `${id}.json`);
    if (!existsSync(filePath)) return undefined;
    return JSON.parse(readFileSync(filePath, "utf-8")) as GenerationRecord;
  }

  /** Return the N most recent generations, optionally filtered by type. */
  recentGenerations(limit = 10, type?: "image" | "video" | "text"): GenerationRecord[] {
    let records = this.listJsonFiles<GenerationRecord>("generations");
    if (type) {
      records = records.filter((r) => r.type === type);
    }
    return records
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  // -- Calendar -------------------------------------------------------------

  saveCalendarSlot(slot: CalendarSlot): void {
    const filePath = join(this.basePath, "calendar", `${slot.id}.json`);
    writeFileSync(filePath, JSON.stringify(slot, null, 2));
  }

  getCalendarSlot(id: string): CalendarSlot | undefined {
    const filePath = join(this.basePath, "calendar", `${id}.json`);
    if (!existsSync(filePath)) return undefined;
    return JSON.parse(readFileSync(filePath, "utf-8")) as CalendarSlot;
  }

  upcomingSlots(days = 7): CalendarSlot[] {
    const now = new Date();
    const cutoff = new Date(now.getTime() + days * 86_400_000);
    return this.listJsonFiles<CalendarSlot>("calendar")
      .filter((s) => {
        const d = new Date(s.date);
        return d >= now && d <= cutoff;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  // -- Characters -----------------------------------------------------------

  saveCharacter(character: CharacterProfile): void {
    const filePath = join(this.basePath, "characters", `${character.id}.json`);
    writeFileSync(filePath, JSON.stringify(character, null, 2));
  }

  getCharacter(id: string): CharacterProfile | undefined {
    const filePath = join(this.basePath, "characters", `${id}.json`);
    if (!existsSync(filePath)) return undefined;
    return JSON.parse(readFileSync(filePath, "utf-8")) as CharacterProfile;
  }

  listCharacters(): CharacterProfile[] {
    return this.listJsonFiles<CharacterProfile>("characters");
  }

  // -- User preferences -----------------------------------------------------

  savePreferences(prefs: UserPreferences): void {
    const filePath = join(this.basePath, "preferences.json");
    writeFileSync(filePath, JSON.stringify(prefs, null, 2));
  }

  getPreferences(): UserPreferences {
    const filePath = join(this.basePath, "preferences.json");
    if (!existsSync(filePath)) return {};
    return JSON.parse(readFileSync(filePath, "utf-8")) as UserPreferences;
  }

  // -- Helpers --------------------------------------------------------------

  private listJsonFiles<T>(subdir: string): T[] {
    const dirPath = join(this.basePath, subdir);
    if (!existsSync(dirPath)) return [];
    const { readdirSync } = require("node:fs") as typeof import("node:fs");
    return readdirSync(dirPath)
      .filter((f: string) => f.endsWith(".json"))
      .map((f: string) => {
        const content = readFileSync(join(dirPath, f), "utf-8");
        return JSON.parse(content) as T;
      });
  }
}
