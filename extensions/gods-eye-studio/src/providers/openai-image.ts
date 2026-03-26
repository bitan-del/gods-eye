// OpenAI image provider — DALL-E 3 and GPT Image generation.

import { resolveApiKeyForProvider } from "godseye/plugin-sdk/provider-auth";

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_IMAGE_MODEL = "gpt-image-1";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OpenAIImageRequest {
  prompt: string;
  model?: string;
  size?: string;
  quality?: "low" | "medium" | "high" | "auto";
  style?: string;
  n?: number;
}

export interface OpenAIImageResult {
  images: Array<{ url?: string; b64Json?: string; mimeType: string; buffer: Buffer }>;
  model: string;
  revisedPrompt?: string;
}

type OpenAIImageResponse = {
  data?: Array<{
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }>;
};

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function resolveOpenAIApiKey(params?: {
  cfg?: Record<string, unknown>;
  agentDir?: string;
  authStore?: unknown;
}): Promise<string> {
  const envKey = process.env.OPENAI_API_KEY?.trim();
  if (envKey) return envKey;

  const auth = await resolveApiKeyForProvider({
    provider: "openai",
    cfg: params?.cfg,
    agentDir: params?.agentDir,
    store: params?.authStore,
  });
  if (!auth.apiKey) {
    throw new Error(
      "OpenAI API key not found. Set OPENAI_API_KEY env var or run godseye onboard to configure.",
    );
  }
  return auth.apiKey;
}

function resolveOpenAIBaseUrl(cfg?: Record<string, unknown>): string {
  const providers = (cfg as { models?: { providers?: { openai?: { baseUrl?: string } } } })?.models
    ?.providers?.openai?.baseUrl?.trim();
  return (providers || DEFAULT_OPENAI_BASE_URL).replace(/\/+$/u, "");
}

// ---------------------------------------------------------------------------
// Image Generation
// ---------------------------------------------------------------------------

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`OpenAI image download failed (${response.status})`);
  }
  return Buffer.from(await response.arrayBuffer());
}

export async function generateImageWithOpenAI(
  request: OpenAIImageRequest,
  cfg?: Record<string, unknown>,
): Promise<OpenAIImageResult> {
  const apiKey = await resolveOpenAIApiKey({ cfg });
  const baseUrl = resolveOpenAIBaseUrl(cfg);
  const model = request.model?.trim() || DEFAULT_IMAGE_MODEL;

  const body: Record<string, unknown> = {
    model,
    prompt: request.prompt,
    n: request.n ?? 1,
    // gpt-image-1 uses b64_json by default for output
    output_format: "b64_json",
  };

  if (request.size) {
    body.size = request.size;
  }
  if (request.quality) {
    body.quality = request.quality;
  }

  const response = await fetch(`${baseUrl}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `OpenAI image generation failed (${response.status}): ${text || response.statusText}`,
    );
  }

  const payload = (await response.json()) as OpenAIImageResponse;
  const images: OpenAIImageResult["images"] = [];
  let revisedPrompt: string | undefined;

  for (const entry of payload.data ?? []) {
    if (entry.revised_prompt && !revisedPrompt) {
      revisedPrompt = entry.revised_prompt;
    }

    if (entry.b64_json) {
      images.push({
        b64Json: entry.b64_json,
        mimeType: "image/png",
        buffer: Buffer.from(entry.b64_json, "base64"),
      });
    } else if (entry.url) {
      const buffer = await fetchImageBuffer(entry.url);
      images.push({
        url: entry.url,
        mimeType: "image/png",
        buffer,
      });
    }
  }

  if (images.length === 0) {
    throw new Error("OpenAI image generation returned no images");
  }

  return { images, model, revisedPrompt };
}
