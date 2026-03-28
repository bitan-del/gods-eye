#!/usr/bin/env bun
/**
 * Gods Eye Online MCP Server
 *
 * Exposes the local Gods Eye fork as an MCP server so that
 * Gods Eye Online (web platform) can use it as a "brain".
 *
 * Tools exposed:
 *  - generate_image   — Image generation via fal.ai
 *  - generate_video   — Video generation via fal.ai
 *  - chat             — Send a message to the local agent
 *  - search_web       — Web search via configured provider
 *  - analyze_brand    — Brand analysis / DNA extraction
 *  - list_models      — List available AI models
 *  - get_status       — Gateway health and connection status
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const GATEWAY_URL = process.env.GODSEYE_GATEWAY_URL ?? "http://localhost:18789";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function gatewayRpc<T = unknown>(
  method: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const res = await fetch(`${GATEWAY_URL}/api/rpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method, params }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gateway RPC ${method} failed (${res.status}): ${text}`);
  }
  const json = (await res.json()) as { result?: T; error?: string };
  if (json.error) {
    throw new Error(`RPC error: ${json.error}`);
  }
  return json.result as T;
}

async function falGenerate(
  model: string,
  params: Record<string, unknown>,
): Promise<{ imageUrl: string; requestId: string }> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    throw new Error("FAL_KEY not configured. Set it in your environment or via godseye config.");
  }

  // Submit to queue
  const submitRes = await fetch(`https://queue.fal.run/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${falKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!submitRes.ok) {
    const text = await submitRes.text();
    throw new Error(`fal.ai submit failed (${submitRes.status}): ${text}`);
  }

  const submitJson = (await submitRes.json()) as {
    request_id: string;
    status_url?: string;
    response_url?: string;
  };
  const requestId = submitJson.request_id;

  // Poll for result
  const resultUrl =
    submitJson.response_url ?? `https://queue.fal.run/${model}/requests/${requestId}`;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const pollRes = await fetch(resultUrl, {
      headers: { Authorization: `Key ${falKey}` },
    });
    if (pollRes.status === 200) {
      const result = (await pollRes.json()) as {
        images?: Array<{ url: string }>;
        image?: { url: string };
      };
      const url = result.images?.[0]?.url ?? result.image?.url;
      if (url) {
        return { imageUrl: url, requestId };
      }
    }
    // 202 = still processing, keep polling
    if (pollRes.status !== 202) {
      const text = await pollRes.text();
      throw new Error(`fal.ai poll unexpected status (${pollRes.status}): ${text}`);
    }
  }
  throw new Error("fal.ai generation timed out after 120s");
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    name: "generate_image",
    description:
      "Generate an image using fal.ai models (Flux, Nano Banana, Imagen 4, Recraft, etc). Returns the image URL.",
    inputSchema: {
      type: "object" as const,
      properties: {
        prompt: { type: "string", description: "Text prompt describing the image to generate" },
        model: {
          type: "string",
          description: "fal.ai model ID (default: fal-ai/flux/dev)",
          enum: [
            "fal-ai/flux/dev",
            "fal-ai/flux-pro/v1.1-ultra",
            "fal-ai/flux-pro",
            "fal-ai/nano-banana-2",
            "fal-ai/nano-banana-pro",
            "fal-ai/nano-banana",
            "fal-ai/google/imagen4/preview",
            "fal-ai/recraft-v3",
            "fal-ai/ideogram/v3",
            "fal-ai/stable-diffusion-v35-large",
            "fal-ai/flux/schnell",
          ],
        },
        aspect_ratio: { type: "string", description: "Aspect ratio (e.g. 16:9, 1:1, 9:16)" },
        num_images: { type: "number", description: "Number of images to generate (1-4)" },
      },
      required: ["prompt"],
    },
  },
  {
    name: "generate_video",
    description: "Generate a video using fal.ai models. Returns the video URL.",
    inputSchema: {
      type: "object" as const,
      properties: {
        prompt: { type: "string", description: "Text prompt describing the video to generate" },
        model: {
          type: "string",
          description: "fal.ai video model ID (default: fal-ai/minimax/video-01-live)",
        },
        duration: { type: "number", description: "Duration in seconds (default: 5)" },
        aspect_ratio: { type: "string", description: "Aspect ratio (e.g. 16:9)" },
      },
      required: ["prompt"],
    },
  },
  {
    name: "chat",
    description:
      "Send a message to the local Gods Eye agent and get a response. The local fork acts as the AI brain.",
    inputSchema: {
      type: "object" as const,
      properties: {
        message: { type: "string", description: "The message to send to the agent" },
        thinking: { type: "string", description: "Thinking level (off, low, medium, high)" },
      },
      required: ["message"],
    },
  },
  {
    name: "search_web",
    description: "Search the web using the configured search provider.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query" },
        max_results: { type: "number", description: "Maximum results to return (default: 5)" },
      },
      required: ["query"],
    },
  },
  {
    name: "analyze_brand",
    description: "Analyze a brand from a URL or text. Extracts colors, fonts, tone, and brand DNA.",
    inputSchema: {
      type: "object" as const,
      properties: {
        source: { type: "string", description: "URL or text to analyze for brand extraction" },
        name: { type: "string", description: "Brand name (optional)" },
      },
      required: ["source"],
    },
  },
  {
    name: "list_models",
    description: "List available AI models for image and video generation.",
    inputSchema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          description: "Filter by type: image, video, or all (default: all)",
        },
      },
    },
  },
  {
    name: "get_status",
    description:
      "Get the current status of the local Gods Eye gateway — channels, connections, and health.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
];

const IMAGE_MODELS = [
  { id: "fal-ai/flux/dev", name: "Flux Dev", speed: "fast" },
  { id: "fal-ai/flux-pro/v1.1-ultra", name: "FLUX Pro Ultra", speed: "medium" },
  { id: "fal-ai/flux-pro", name: "FLUX Pro", speed: "medium" },
  { id: "fal-ai/nano-banana-2", name: "Nano Banana 2 (Gemini 3.1 Flash)", speed: "fast" },
  { id: "fal-ai/nano-banana-pro", name: "Nano Banana Pro (Gemini 3 Pro)", speed: "medium" },
  { id: "fal-ai/nano-banana", name: "Nano Banana (Gemini 2.5 Flash)", speed: "fast" },
  { id: "fal-ai/google/imagen4/preview", name: "Imagen 4", speed: "medium" },
  { id: "fal-ai/recraft-v3", name: "Recraft V3", speed: "medium" },
  { id: "fal-ai/ideogram/v3", name: "Ideogram V3", speed: "medium" },
  { id: "fal-ai/stable-diffusion-v35-large", name: "SD 3.5 Large", speed: "medium" },
  { id: "fal-ai/flux/schnell", name: "Flux Schnell", speed: "fastest" },
];

const VIDEO_MODELS = [
  { id: "fal-ai/minimax/video-01-live", name: "MiniMax Video 01 Live", speed: "slow" },
  { id: "fal-ai/kling-video/v1.5/pro", name: "Kling Video v1.5 Pro", speed: "slow" },
];

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const server = new Server(
  { name: "gods-eye-online", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "generate_image": {
      const prompt = args?.prompt as string;
      const model = (args?.model as string) ?? "fal-ai/flux/dev";
      const aspectRatio = (args?.aspect_ratio as string) ?? "16:9";
      const numImages = (args?.num_images as number) ?? 1;

      const result = await falGenerate(model, {
        prompt,
        image_size:
          aspectRatio === "1:1"
            ? "square_hd"
            : aspectRatio === "16:9"
              ? "landscape_16_9"
              : aspectRatio === "9:16"
                ? "portrait_16_9"
                : "landscape_16_9",
        num_images: Math.min(numImages, 4),
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ imageUrl: result.imageUrl, model, requestId: result.requestId }),
          },
        ],
      };
    }

    case "generate_video": {
      const prompt = args?.prompt as string;
      const model = (args?.model as string) ?? "fal-ai/minimax/video-01-live";

      const result = await falGenerate(model, {
        prompt,
        duration: (args?.duration as number) ?? 5,
        aspect_ratio: (args?.aspect_ratio as string) ?? "16:9",
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ videoUrl: result.imageUrl, model, requestId: result.requestId }),
          },
        ],
      };
    }

    case "chat": {
      const message = args?.message as string;
      try {
        const result = await gatewayRpc<{ reply: string }>("agent.message", {
          message,
          thinking: (args?.thinking as string) ?? "low",
        });
        return {
          content: [{ type: "text", text: result.reply ?? JSON.stringify(result) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Gateway chat error: ${(err as Error).message}` }],
          isError: true,
        };
      }
    }

    case "search_web": {
      try {
        const result = await gatewayRpc("web.search", {
          query: args?.query as string,
          maxResults: (args?.max_results as number) ?? 5,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Search error: ${(err as Error).message}` }],
          isError: true,
        };
      }
    }

    case "analyze_brand": {
      try {
        const result = await gatewayRpc("studio.brand.scan", {
          source: args?.source as string,
          name: (args?.name as string) ?? "",
        });
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Brand analysis error: ${(err as Error).message}` }],
          isError: true,
        };
      }
    }

    case "list_models": {
      const filterType = (args?.type as string) ?? "all";
      const models = {
        image: filterType === "video" ? [] : IMAGE_MODELS,
        video: filterType === "image" ? [] : VIDEO_MODELS,
      };
      return {
        content: [{ type: "text", text: JSON.stringify(models) }],
      };
    }

    case "get_status": {
      try {
        const result = await gatewayRpc("gateway.status");
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Status error: ${(err as Error).message}` }],
          isError: true,
        };
      }
    }

    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[gods-eye-online] MCP server started — local brain ready for Gods Eye Online");
}

main().catch((err) => {
  console.error("[gods-eye-online] Fatal:", err);
  process.exit(1);
});
