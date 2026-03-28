#!/usr/bin/env bun
/**
 * HTTP-SSE Bridge for Gods Eye Online
 *
 * Gods Eye Online is a web app and cannot use stdio MCP transport directly.
 * This bridge exposes the MCP server over HTTP with SSE (Server-Sent Events)
 * so the web client can connect.
 *
 * Endpoints:
 *   GET  /sse          — SSE stream for server->client messages
 *   POST /message      — Client->server JSON-RPC messages
 *   GET  /health       — Health check
 *   GET  /              — Info page
 *
 * Usage:
 *   bun extensions/gods-eye-online/src/http-bridge.ts [--port 18790]
 *
 * Environment:
 *   GODSEYE_ONLINE_BRIDGE_PORT — Port (default: 18790)
 *   FAL_KEY                    — fal.ai API key for image/video generation
 *   GODSEYE_GATEWAY_URL        — Local gateway URL (default: http://localhost:18789)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

// Re-use the same tool logic
const GATEWAY_URL = process.env.GODSEYE_GATEWAY_URL ?? "http://localhost:18789";
const PORT = Number(process.env.GODSEYE_ONLINE_BRIDGE_PORT) || 18790;

// ---------------------------------------------------------------------------
// SSE Connection manager
// ---------------------------------------------------------------------------

interface SseClient {
  id: string;
  controller: ReadableStreamDefaultController;
}

const clients = new Map<string, SseClient>();
let clientIdCounter = 0;

function broadcastToClient(clientId: string, data: unknown) {
  const client = clients.get(clientId);
  if (!client) return;
  const encoder = new TextEncoder();
  client.controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
}

// ---------------------------------------------------------------------------
// HTTP Server
// ---------------------------------------------------------------------------

const httpServer = Bun.serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);

    // CORS headers for web access
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Health check
    if (url.pathname === "/health") {
      return Response.json(
        { status: "ok", server: "gods-eye-online-bridge", version: "0.1.0" },
        { headers: corsHeaders },
      );
    }

    // Info
    if (url.pathname === "/" && req.method === "GET") {
      return Response.json(
        {
          name: "Gods Eye Online MCP Bridge",
          version: "0.1.0",
          description: "HTTP-SSE bridge connecting Gods Eye Online to local Gods Eye fork",
          endpoints: {
            sse: "/sse",
            message: "/message",
            health: "/health",
          },
          tools: [
            "generate_image",
            "generate_video",
            "chat",
            "search_web",
            "analyze_brand",
            "list_models",
            "get_status",
          ],
        },
        { headers: corsHeaders },
      );
    }

    // SSE endpoint
    if (url.pathname === "/sse" && req.method === "GET") {
      const clientId = `client-${++clientIdCounter}`;

      const stream = new ReadableStream({
        start(controller) {
          clients.set(clientId, { id: clientId, controller });
          // Send initial connection event
          const encoder = new TextEncoder();
          controller.enqueue(
            encoder.encode(`event: endpoint\ndata: /message?clientId=${clientId}\n\n`),
          );
          console.error(`[bridge] SSE client connected: ${clientId}`);
        },
        cancel() {
          clients.delete(clientId);
          console.error(`[bridge] SSE client disconnected: ${clientId}`);
        },
      });

      return new Response(stream, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Message endpoint (JSON-RPC from client)
    if (url.pathname === "/message" && req.method === "POST") {
      const clientId = url.searchParams.get("clientId");
      if (!clientId || !clients.has(clientId)) {
        return Response.json(
          { error: "Invalid or missing clientId. Connect via /sse first." },
          { status: 400, headers: corsHeaders },
        );
      }

      return (async () => {
        const body = (await req.json()) as {
          method?: string;
          id?: number;
          params?: Record<string, unknown>;
        };

        // Handle tools/list
        if (body.method === "tools/list") {
          const response = {
            jsonrpc: "2.0",
            id: body.id,
            result: { tools: TOOLS },
          };
          broadcastToClient(clientId, response);
          return Response.json({ status: "ok" }, { headers: corsHeaders });
        }

        // Handle tools/call
        if (body.method === "tools/call") {
          const toolName = body.params?.name as string;
          const toolArgs = body.params?.arguments as Record<string, unknown>;
          try {
            const result = await handleToolCall(toolName, toolArgs ?? {});
            broadcastToClient(clientId, {
              jsonrpc: "2.0",
              id: body.id,
              result,
            });
          } catch (err) {
            broadcastToClient(clientId, {
              jsonrpc: "2.0",
              id: body.id,
              error: { code: -1, message: (err as Error).message },
            });
          }
          return Response.json({ status: "ok" }, { headers: corsHeaders });
        }

        // Handle initialize
        if (body.method === "initialize") {
          broadcastToClient(clientId, {
            jsonrpc: "2.0",
            id: body.id,
            result: {
              protocolVersion: "2024-11-05",
              serverInfo: { name: "gods-eye-online", version: "0.1.0" },
              capabilities: { tools: {} },
            },
          });
          return Response.json({ status: "ok" }, { headers: corsHeaders });
        }

        return Response.json(
          { error: `Unknown method: ${body.method}` },
          { status: 400, headers: corsHeaders },
        );
      })();
    }

    return Response.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
  },
});

// ---------------------------------------------------------------------------
// Tool definitions & handler (shared with mcp-server.ts)
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    name: "generate_image",
    description: "Generate an image using fal.ai models. Returns the image URL.",
    inputSchema: {
      type: "object" as const,
      properties: {
        prompt: { type: "string", description: "Text prompt for image generation" },
        model: { type: "string", description: "fal.ai model ID (default: fal-ai/flux/dev)" },
        aspect_ratio: { type: "string", description: "Aspect ratio (e.g. 16:9, 1:1)" },
        num_images: { type: "number", description: "Number of images (1-4)" },
      },
      required: ["prompt"],
    },
  },
  {
    name: "generate_video",
    description: "Generate a video using fal.ai. Returns the video URL.",
    inputSchema: {
      type: "object" as const,
      properties: {
        prompt: { type: "string", description: "Text prompt for video generation" },
        model: { type: "string", description: "fal.ai video model ID" },
        duration: { type: "number", description: "Duration in seconds" },
      },
      required: ["prompt"],
    },
  },
  {
    name: "chat",
    description: "Send a message to the local Gods Eye agent (brain).",
    inputSchema: {
      type: "object" as const,
      properties: {
        message: { type: "string", description: "Message to send" },
        thinking: { type: "string", description: "Thinking level (off, low, medium, high)" },
      },
      required: ["message"],
    },
  },
  {
    name: "search_web",
    description: "Web search via configured provider.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query" },
        max_results: { type: "number", description: "Max results" },
      },
      required: ["query"],
    },
  },
  {
    name: "analyze_brand",
    description: "Extract brand DNA from a URL or text.",
    inputSchema: {
      type: "object" as const,
      properties: {
        source: { type: "string", description: "URL or text to analyze" },
        name: { type: "string", description: "Brand name" },
      },
      required: ["source"],
    },
  },
  {
    name: "list_models",
    description: "List available AI models.",
    inputSchema: {
      type: "object" as const,
      properties: {
        type: { type: "string", description: "Filter: image, video, or all" },
      },
    },
  },
  {
    name: "get_status",
    description: "Get local gateway status.",
    inputSchema: { type: "object" as const, properties: {} },
  },
];

async function falGenerate(
  model: string,
  params: Record<string, unknown>,
): Promise<{ imageUrl: string; requestId: string }> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) throw new Error("FAL_KEY not configured");

  const submitRes = await fetch(`https://queue.fal.run/${model}`, {
    method: "POST",
    headers: { Authorization: `Key ${falKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!submitRes.ok) throw new Error(`fal.ai submit failed: ${await submitRes.text()}`);

  const submitJson = (await submitRes.json()) as { request_id: string; response_url?: string };
  const resultUrl =
    submitJson.response_url ?? `https://queue.fal.run/${model}/requests/${submitJson.request_id}`;

  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const pollRes = await fetch(resultUrl, { headers: { Authorization: `Key ${falKey}` } });
    if (pollRes.status === 200) {
      const result = (await pollRes.json()) as {
        images?: Array<{ url: string }>;
        image?: { url: string };
      };
      const url = result.images?.[0]?.url ?? result.image?.url;
      if (url) return { imageUrl: url, requestId: submitJson.request_id };
    }
    if (pollRes.status !== 202) throw new Error(`fal.ai poll error: ${await pollRes.text()}`);
  }
  throw new Error("fal.ai generation timed out");
}

async function gatewayRpc<T = unknown>(
  method: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const res = await fetch(`${GATEWAY_URL}/api/rpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method, params }),
  });
  if (!res.ok) throw new Error(`Gateway RPC failed (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as { result?: T; error?: string };
  if (json.error) throw new Error(json.error);
  return json.result as T;
}

async function handleToolCall(name: string, args: Record<string, unknown>) {
  switch (name) {
    case "generate_image": {
      const result = await falGenerate((args.model as string) ?? "fal-ai/flux/dev", {
        prompt: args.prompt,
        image_size: args.aspect_ratio === "1:1" ? "square_hd" : "landscape_16_9",
        num_images: Math.min((args.num_images as number) ?? 1, 4),
      });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
    case "generate_video": {
      const result = await falGenerate((args.model as string) ?? "fal-ai/minimax/video-01-live", {
        prompt: args.prompt,
        duration: (args.duration as number) ?? 5,
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ videoUrl: result.imageUrl, requestId: result.requestId }),
          },
        ],
      };
    }
    case "chat": {
      const result = await gatewayRpc<{ reply: string }>("agent.message", {
        message: args.message,
        thinking: (args.thinking as string) ?? "low",
      });
      return { content: [{ type: "text", text: result.reply ?? JSON.stringify(result) }] };
    }
    case "search_web": {
      const result = await gatewayRpc("web.search", {
        query: args.query,
        maxResults: (args.max_results as number) ?? 5,
      });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
    case "analyze_brand": {
      const result = await gatewayRpc("studio.brand.scan", {
        source: args.source,
        name: args.name ?? "",
      });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
    case "list_models": {
      const filter = (args.type as string) ?? "all";
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              image:
                filter === "video"
                  ? []
                  : [
                      { id: "fal-ai/flux/dev", name: "Flux Dev" },
                      { id: "fal-ai/flux-pro/v1.1-ultra", name: "FLUX Pro Ultra" },
                      { id: "fal-ai/nano-banana-2", name: "Nano Banana 2" },
                      { id: "fal-ai/nano-banana-pro", name: "Nano Banana Pro" },
                      { id: "fal-ai/nano-banana", name: "Nano Banana" },
                      { id: "fal-ai/google/imagen4/preview", name: "Imagen 4" },
                      { id: "fal-ai/recraft-v3", name: "Recraft V3" },
                    ],
              video:
                filter === "image"
                  ? []
                  : [{ id: "fal-ai/minimax/video-01-live", name: "MiniMax Video" }],
            }),
          },
        ],
      };
    }
    case "get_status": {
      const result = await gatewayRpc("gateway.status");
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
    default:
      return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
  }
}

console.error(`[gods-eye-online] HTTP-SSE bridge listening on http://localhost:${PORT}`);
console.error(`[gods-eye-online] Gateway: ${GATEWAY_URL}`);
console.error(
  `[gods-eye-online] Connect from Gods Eye Online via SSE at http://localhost:${PORT}/sse`,
);
