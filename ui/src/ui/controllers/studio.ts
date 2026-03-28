// Studio controller — RPC calls and state management for Gods Eye Studio tabs.
// Handles image gen, video gen, brand scan, calendar, and gallery operations
// via gateway RPC calls to the gods-eye-studio extension.

import type { GatewayBrowserClient } from "../gateway.ts";

// ---------------------------------------------------------------------------
// State types
// ---------------------------------------------------------------------------

export type StudioState = {
  connected: boolean;
  client: GatewayBrowserClient | null;

  // Shared
  studioActiveBrand: {
    id: string;
    name: string;
    colors: { primary: string; secondary: string };
  } | null;

  // Image Gen
  studioImageGenLoading: boolean;
  studioImageGenGenerating: boolean;
  studioImageGenError: string | null;
  studioImageGenPrompt: string;
  studioImageGenModel: string;
  studioImageGenWidth: number;
  studioImageGenHeight: number;
  studioImageGenStyle: string;
  studioImageGenAspectRatio: string;
  studioImageGenResolution: string;
  studioImageGenBatchCount: number;
  studioImageGenLastResult: {
    id: string;
    model: string;
    prompt: string;
    imageCount: number;
    savedTo?: string;
    imageUrl?: string;
    thumbnailUrl?: string;
    createdAt: string;
  } | null;
  studioImageGenRecent: Array<{
    id: string;
    model: string;
    prompt: string;
    imageCount: number;
    savedTo?: string;
    imageUrl?: string;
    thumbnailUrl?: string;
    createdAt: string;
  }>;

  // Video Gen
  studioVideoGenLoading: boolean;
  studioVideoGenGenerating: boolean;
  studioVideoGenError: string | null;
  studioVideoGenPrompt: string;
  studioVideoGenModel: string;
  studioVideoGenDuration: number;
  studioVideoGenAspectRatio: string;
  studioVideoGenLastResult: { id: string; model: string; videoUrl: string } | null;

  // Brand
  studioBrandLoading: boolean;
  studioBrandScanning: boolean;
  studioBrandError: string | null;
  studioBrandScanSource: string;
  studioBrandScanName: string;
  studioBrands: Array<{
    id: string;
    name: string;
    colors: { primary: string; secondary: string; accent?: string };
    fonts?: { heading?: string; body?: string };
    tone?: string;
    visualStyle?: string;
    createdAt: string;
  }>;

  // Calendar
  studioCalendarLoading: boolean;
  studioCalendarError: string | null;
  studioCalendarSlots: Array<{
    id: string;
    date: string;
    platform?: string;
    status: "ideated" | "generated" | "approved" | "published";
    generationId?: string;
    notes?: string;
  }>;
  studioCalendarNewDate: string;
  studioCalendarNewPlatform: string;
  studioCalendarNewNotes: string;

  // Gallery
  studioGalleryLoading: boolean;
  studioGalleryError: string | null;
  studioGalleryItems: Array<{
    id: string;
    type: "image" | "video" | "text";
    prompt: string;
    model: string;
    provider: string;
    brandName?: string;
    tags: string[];
    createdAt: string;
    resultRef?: string;
  }>;
  studioGalleryFilter: "all" | "image" | "video" | "text";
  studioGallerySearch: string;
};

// ---------------------------------------------------------------------------
// Image Generation
// ---------------------------------------------------------------------------

// Load recent image generations from brain gallery into the Image Gen tab.
export async function loadImageGenRecent(state: StudioState) {
  if (!state.client || !state.connected) {
    return;
  }
  try {
    const items = await state.client.request<
      Array<{
        id: string;
        model: string;
        prompt: string;
        imageCount: number;
        savedTo?: string;
        imageUrl?: string;
        thumbnailUrl?: string;
        createdAt: string;
      }>
    >("studio.gallery.list", { timeoutMs: 10_000 });
    if (Array.isArray(items)) {
      // Filter to image type and take the most recent 10
      state.studioImageGenRecent = items.slice(0, 10);
    }
  } catch {
    // Non-fatal — gallery may not be available yet.
  }
}

export async function handleStudioImageGenerate(state: StudioState) {
  if (!state.client || !state.connected) {
    return;
  }
  state.studioImageGenGenerating = true;
  state.studioImageGenError = null;

  try {
    const result = await state.client.request<{
      id: string;
      model: string;
      prompt: string;
      imageCount: number;
      savedTo?: string;
    }>("studio.image.generate", {
      prompt: state.studioImageGenPrompt,
      model: state.studioImageGenModel,
      width: state.studioImageGenWidth,
      height: state.studioImageGenHeight,
      style: state.studioImageGenStyle || undefined,
      timeoutMs: 120_000,
    });

    const genResult = { ...result, createdAt: new Date().toISOString() };
    state.studioImageGenLastResult = genResult;
    state.studioImageGenRecent = [genResult, ...state.studioImageGenRecent.slice(0, 9)];
    state.studioImageGenPrompt = "";
  } catch (err) {
    state.studioImageGenError = err instanceof Error ? err.message : String(err);
  } finally {
    state.studioImageGenGenerating = false;
  }
}

// ---------------------------------------------------------------------------
// Video Generation
// ---------------------------------------------------------------------------

export async function handleStudioVideoGenerate(state: StudioState) {
  if (!state.client || !state.connected) {
    return;
  }
  state.studioVideoGenGenerating = true;
  state.studioVideoGenError = null;

  try {
    const result = await state.client.request<{
      id: string;
      model: string;
      videoUrl: string;
    }>("studio.video.generate", {
      prompt: state.studioVideoGenPrompt,
      model: state.studioVideoGenModel,
      duration: state.studioVideoGenDuration,
      aspectRatio: state.studioVideoGenAspectRatio,
      timeoutMs: 360_000,
    });

    state.studioVideoGenLastResult = result;
    state.studioVideoGenPrompt = "";
  } catch (err) {
    state.studioVideoGenError = err instanceof Error ? err.message : String(err);
  } finally {
    state.studioVideoGenGenerating = false;
  }
}

// ---------------------------------------------------------------------------
// Brand Scan
// ---------------------------------------------------------------------------

export async function handleStudioBrandScan(state: StudioState) {
  if (!state.client || !state.connected) {
    return;
  }
  state.studioBrandScanning = true;
  state.studioBrandError = null;

  try {
    const result = await state.client.request<{
      brandId: string;
      brand: StudioState["studioBrands"][number];
    }>("studio.brand.scan", {
      source: state.studioBrandScanSource,
      name: state.studioBrandScanName,
      setAsDefault: true,
      timeoutMs: 30_000,
    });

    state.studioBrands = [result.brand, ...state.studioBrands];
    state.studioActiveBrand = {
      id: result.brand.id,
      name: result.brand.name,
      colors: result.brand.colors,
    };
    state.studioBrandScanSource = "";
    state.studioBrandScanName = "";
  } catch (err) {
    state.studioBrandError = err instanceof Error ? err.message : String(err);
  } finally {
    state.studioBrandScanning = false;
  }
}

export function handleStudioSetActiveBrand(state: StudioState, brandId: string) {
  const brand = state.studioBrands.find((b) => b.id === brandId);
  if (brand) {
    state.studioActiveBrand = { id: brand.id, name: brand.name, colors: brand.colors };
  }
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

export async function handleStudioCalendarCreate(state: StudioState) {
  if (!state.client || !state.connected) {
    return;
  }
  state.studioCalendarError = null;

  try {
    const result = await state.client.request<StudioState["studioCalendarSlots"][number]>(
      "studio.calendar.create",
      {
        date: state.studioCalendarNewDate,
        platform: state.studioCalendarNewPlatform || undefined,
        notes: state.studioCalendarNewNotes || undefined,
        timeoutMs: 5_000,
      },
    );

    state.studioCalendarSlots = [...state.studioCalendarSlots, result];
    state.studioCalendarNewDate = "";
    state.studioCalendarNewPlatform = "";
    state.studioCalendarNewNotes = "";
  } catch (err) {
    state.studioCalendarError = err instanceof Error ? err.message : String(err);
  }
}

export async function handleStudioCalendarUpdate(
  state: StudioState,
  slotId: string,
  status: string,
) {
  if (!state.client || !state.connected) {
    return;
  }

  try {
    await state.client.request("studio.calendar.update", {
      slotId,
      status,
      timeoutMs: 5_000,
    });

    state.studioCalendarSlots = state.studioCalendarSlots.map((s) =>
      s.id === slotId
        ? { ...s, status: status as "ideated" | "generated" | "approved" | "published" }
        : s,
    );
  } catch (err) {
    state.studioCalendarError = err instanceof Error ? err.message : String(err);
  }
}

export async function handleStudioCalendarRefresh(state: StudioState) {
  if (!state.client || !state.connected) {
    return;
  }
  state.studioCalendarLoading = true;

  try {
    const result = await state.client.request<StudioState["studioCalendarSlots"]>(
      "studio.calendar.list",
      { timeoutMs: 5_000 },
    );
    state.studioCalendarSlots = result;
  } catch (err) {
    state.studioCalendarError = err instanceof Error ? err.message : String(err);
  } finally {
    state.studioCalendarLoading = false;
  }
}

// ---------------------------------------------------------------------------
// Gallery
// ---------------------------------------------------------------------------

export async function handleStudioGalleryRefresh(state: StudioState) {
  if (!state.client || !state.connected) {
    return;
  }
  state.studioGalleryLoading = true;
  state.studioGalleryError = null;

  try {
    const result = await state.client.request<StudioState["studioGalleryItems"]>(
      "studio.gallery.list",
      { timeoutMs: 10_000 },
    );
    state.studioGalleryItems = result;
  } catch (err) {
    state.studioGalleryError = err instanceof Error ? err.message : String(err);
  } finally {
    state.studioGalleryLoading = false;
  }
}
