// fal.ai provider — handles actual API calls for image and video generation.
// Uses the same auth resolution as the bundled fal extension.

import { type AuthProfileStore, resolveApiKeyForProvider } from "godseye/plugin-sdk/provider-auth";

const DEFAULT_FAL_BASE_URL = "https://fal.run";
const DEFAULT_FAL_QUEUE_URL = "https://queue.fal.run";
const DEFAULT_IMAGE_MODEL = "fal-ai/flux/dev";
const DEFAULT_VIDEO_MODEL = "fal-ai/minimax/video-01-live";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FalImageRequest {
  prompt: string;
  model?: string;
  width?: number;
  height?: number;
  numImages?: number;
}

export interface FalImageResult {
  images: Array<{ url: string; mimeType: string; buffer: Buffer }>;
  model: string;
  revisedPrompt?: string;
}

export interface FalVideoRequest {
  prompt: string;
  model?: string;
  duration?: number;
  aspectRatio?: string;
}

export interface FalVideoResult {
  videoUrl: string;
  model: string;
  durationSeconds?: number;
}

type FalGenerateResponse = {
  images?: Array<{ url?: string; content_type?: string }>;
  video?: { url?: string };
  prompt?: string;
};

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function resolveFalApiKey(params: {
  cfg?: Record<string, unknown>;
  agentDir?: string;
  authStore?: unknown;
}): Promise<string> {
  // Try environment variable first
  const envKey = process.env.FAL_KEY?.trim();
  if (envKey) return envKey;

  // Fall back to the plugin auth system
  const auth = await resolveApiKeyForProvider({
    provider: "fal",
    cfg: params.cfg,
    agentDir: params.agentDir,
    store: params.authStore as AuthProfileStore | undefined,
  });
  if (!auth.apiKey) {
    throw new Error(
      "fal API key not found. Set FAL_KEY env var or run godseye onboard to configure.",
    );
  }
  return auth.apiKey;
}

function resolveFalBaseUrl(cfg?: Record<string, unknown>): string {
  const providers = (
    cfg as { models?: { providers?: { fal?: { baseUrl?: string } } } }
  )?.models?.providers?.fal?.baseUrl?.trim();
  return (providers || DEFAULT_FAL_BASE_URL).replace(/\/+$/u, "");
}

// ---------------------------------------------------------------------------
// Image Generation
// ---------------------------------------------------------------------------

async function fetchImageBuffer(url: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `fal image download failed (${response.status}): ${text || response.statusText}`,
    );
  }
  const mimeType = response.headers.get("content-type")?.trim() || "image/png";
  const arrayBuffer = await response.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), mimeType };
}

export async function generateImageWithFal(
  request: FalImageRequest,
  cfg?: Record<string, unknown>,
): Promise<FalImageResult> {
  const apiKey = await resolveFalApiKey({ cfg });
  const baseUrl = resolveFalBaseUrl(cfg);
  const model = request.model?.trim() || DEFAULT_IMAGE_MODEL;

  const body: Record<string, unknown> = {
    prompt: request.prompt,
    num_images: request.numImages ?? 1,
    output_format: "png",
  };
  if (request.width && request.height) {
    body.image_size = { width: request.width, height: request.height };
  }

  const response = await fetch(`${baseUrl}/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `fal image generation failed (${response.status}): ${text || response.statusText}`,
    );
  }

  const payload = (await response.json()) as FalGenerateResponse;
  const images: FalImageResult["images"] = [];
  for (const entry of payload.images ?? []) {
    const url = entry.url?.trim();
    if (!url) continue;
    const downloaded = await fetchImageBuffer(url);
    images.push({
      url,
      mimeType: downloaded.mimeType,
      buffer: downloaded.buffer,
    });
  }

  if (images.length === 0) {
    throw new Error("fal image generation returned no images");
  }

  return {
    images,
    model,
    revisedPrompt: payload.prompt ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Video Generation
// ---------------------------------------------------------------------------

export async function generateVideoWithFal(
  request: FalVideoRequest,
  cfg?: Record<string, unknown>,
): Promise<FalVideoResult> {
  const apiKey = await resolveFalApiKey({ cfg });
  const model = request.model?.trim() || DEFAULT_VIDEO_MODEL;

  // Video generation uses the queue API (async processing)
  const body: Record<string, unknown> = {
    prompt: request.prompt,
  };
  if (request.duration) {
    body.duration = request.duration;
  }
  if (request.aspectRatio) {
    body.aspect_ratio = request.aspectRatio;
  }

  // Submit to queue
  const submitResponse = await fetch(`${DEFAULT_FAL_QUEUE_URL}/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!submitResponse.ok) {
    const text = await submitResponse.text().catch(() => "");
    throw new Error(
      `fal video generation submit failed (${submitResponse.status}): ${text || submitResponse.statusText}`,
    );
  }

  const submitPayload = (await submitResponse.json()) as {
    request_id?: string;
    status_url?: string;
    response_url?: string;
  };

  const requestId = submitPayload.request_id;
  if (!requestId) {
    throw new Error("fal video generation: no request_id in response");
  }

  // Poll for completion
  const statusUrl =
    submitPayload.status_url ?? `${DEFAULT_FAL_QUEUE_URL}/${model}/requests/${requestId}/status`;
  const responseUrl =
    submitPayload.response_url ?? `${DEFAULT_FAL_QUEUE_URL}/${model}/requests/${requestId}`;

  const maxWaitMs = 300_000; // 5 minutes
  const pollIntervalMs = 3_000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const statusRes = await fetch(statusUrl, {
      headers: { Authorization: `Key ${apiKey}` },
    });
    if (!statusRes.ok) {
      await new Promise((r) => setTimeout(r, pollIntervalMs));
      continue;
    }
    const statusPayload = (await statusRes.json()) as {
      status?: string;
      logs?: Array<{ message?: string }>;
    };

    if (statusPayload.status === "COMPLETED") {
      break;
    }
    if (statusPayload.status === "FAILED") {
      const lastLog = statusPayload.logs?.at(-1)?.message ?? "unknown error";
      throw new Error(`fal video generation failed: ${lastLog}`);
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  // Fetch the result
  const resultRes = await fetch(responseUrl, {
    headers: { Authorization: `Key ${apiKey}` },
  });
  if (!resultRes.ok) {
    const text = await resultRes.text().catch(() => "");
    throw new Error(
      `fal video result fetch failed (${resultRes.status}): ${text || resultRes.statusText}`,
    );
  }

  const resultPayload = (await resultRes.json()) as FalGenerateResponse;
  const videoUrl = resultPayload.video?.url?.trim();
  if (!videoUrl) {
    throw new Error("fal video generation returned no video URL");
  }

  return {
    videoUrl,
    model,
    durationSeconds: request.duration,
  };
}
