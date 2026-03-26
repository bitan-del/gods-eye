// Google Gemini provider — handles brand analysis, creative reasoning,
// and Imagen image generation through the Gemini API.

import { resolveApiKeyForProvider } from "godseye/plugin-sdk/provider-auth";

const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_ANALYSIS_MODEL = "gemini-2.5-flash";
const DEFAULT_IMAGE_MODEL = "gemini-3.1-flash-image-preview";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GeminiBrandAnalysis {
  colors: { primary: string; secondary: string; accent?: string };
  fonts?: { heading?: string; body?: string };
  tone?: string;
  visualStyle?: string;
  summary: string;
}

export interface GeminiCreativeResponse {
  text: string;
  model: string;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function resolveGeminiApiKey(params?: {
  cfg?: Record<string, unknown>;
  agentDir?: string;
  authStore?: unknown;
}): Promise<string> {
  // Try environment variables first
  const envKey = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY)?.trim();
  if (envKey) return envKey;

  // Fall back to plugin auth system
  const auth = await resolveApiKeyForProvider({
    provider: "google",
    cfg: params?.cfg,
    agentDir: params?.agentDir,
    store: params?.authStore,
  });
  if (!auth.apiKey) {
    throw new Error(
      "Gemini API key not found. Set GEMINI_API_KEY env var or run godseye onboard to configure.",
    );
  }
  return auth.apiKey;
}

function resolveGeminiBaseUrl(cfg?: Record<string, unknown>): string {
  const providers = (cfg as { models?: { providers?: { google?: { baseUrl?: string } } } })?.models
    ?.providers?.google?.baseUrl?.trim();
  return (providers || DEFAULT_GEMINI_BASE_URL).replace(/\/+$/u, "");
}

// ---------------------------------------------------------------------------
// Brand Analysis (uses Gemini text model)
// ---------------------------------------------------------------------------

export async function analyzeBrandWithGemini(
  source: string,
  cfg?: Record<string, unknown>,
): Promise<GeminiBrandAnalysis> {
  const apiKey = await resolveGeminiApiKey({ cfg });
  const baseUrl = resolveGeminiBaseUrl(cfg);

  const prompt = `Analyze the following brand source and extract brand DNA. Return a JSON object with these fields:
- colors: { primary: string (hex), secondary: string (hex), accent?: string (hex) }
- fonts: { heading?: string, body?: string }
- tone: string (e.g. "professional", "playful", "minimalist")
- visualStyle: string (e.g. "modern gradient", "flat design", "organic")
- summary: string (one-line brand identity summary)

Source to analyze:
${source}

Return ONLY valid JSON, no markdown fences.`;

  const response = await fetch(
    `${baseUrl}/models/${DEFAULT_ANALYSIS_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Gemini brand analysis failed (${response.status}): ${text || response.statusText}`,
    );
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const textContent = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!textContent) {
    throw new Error("Gemini brand analysis returned empty response");
  }

  try {
    return JSON.parse(textContent) as GeminiBrandAnalysis;
  } catch {
    // If JSON parse fails, extract what we can
    return {
      colors: { primary: "#000000", secondary: "#ffffff" },
      tone: "unknown",
      visualStyle: "unknown",
      summary: textContent.slice(0, 200),
    };
  }
}

// ---------------------------------------------------------------------------
// Creative Reasoning (general-purpose creative prompts via Gemini)
// ---------------------------------------------------------------------------

export async function reasonWithGemini(
  prompt: string,
  cfg?: Record<string, unknown>,
): Promise<GeminiCreativeResponse> {
  const apiKey = await resolveGeminiApiKey({ cfg });
  const baseUrl = resolveGeminiBaseUrl(cfg);

  const response = await fetch(
    `${baseUrl}/models/${DEFAULT_ANALYSIS_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7 },
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Gemini creative reasoning failed (${response.status}): ${text || response.statusText}`,
    );
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const textContent = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!textContent) {
    throw new Error("Gemini returned empty response");
  }

  return { text: textContent, model: DEFAULT_ANALYSIS_MODEL };
}

// ---------------------------------------------------------------------------
// Image Generation via Gemini Imagen
// ---------------------------------------------------------------------------

export interface GeminiImageResult {
  images: Array<{ buffer: Buffer; mimeType: string }>;
  model: string;
}

export async function generateImageWithGemini(
  prompt: string,
  cfg?: Record<string, unknown>,
  options?: { model?: string; aspectRatio?: string },
): Promise<GeminiImageResult> {
  const apiKey = await resolveGeminiApiKey({ cfg });
  const baseUrl = resolveGeminiBaseUrl(cfg);
  const model = options?.model?.trim() || DEFAULT_IMAGE_MODEL;

  const generationConfig: Record<string, unknown> = {
    responseModalities: ["TEXT", "IMAGE"],
  };
  if (options?.aspectRatio) {
    generationConfig.imageConfig = { aspectRatio: options.aspectRatio };
  }

  const response = await fetch(`${baseUrl}/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Gemini image generation failed (${response.status}): ${text || response.statusText}`,
    );
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
          inlineData?: { mimeType?: string; data?: string };
          inline_data?: { mime_type?: string; data?: string };
        }>;
      };
    }>;
  };

  const images: GeminiImageResult["images"] = [];
  for (const candidate of payload.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      const inline = part.inlineData ?? part.inline_data;
      const data = (inline?.data ?? inline?.data)?.trim();
      if (!data) continue;
      const mimeType = inline?.mimeType ?? inline?.mime_type ?? "image/png";
      images.push({
        buffer: Buffer.from(data, "base64"),
        mimeType,
      });
    }
  }

  if (images.length === 0) {
    throw new Error("Gemini image generation returned no images");
  }

  return { images, model };
}
