import http from "node:http";
import type { AddressInfo } from "node:net";
import {
  getShimHandler,
  type ZeroApiHandler,
  type ZeroApiIncomingMessage,
} from "./handler-registry.js";
import {
  buildChunkId,
  buildDeltaChunk,
  buildRoleStartChunk,
  buildStopChunk,
  encodeChunk,
  SSE_DONE,
} from "./openai-compat.js";
import { stripInboundMeta } from "./strip-inbound-meta.js";

const SHIM_HOST = "127.0.0.1";
const SHIM_PORT = 64201;
const ROUTE_PREFIX = "/v1/zero-api";

type ShimState = {
  server: http.Server;
  startedAt: number;
};

let shimState: ShimState | null = null;
let startPromise: Promise<void> | null = null;

/**
 * Start the local OpenAI-compat shim on 127.0.0.1:64201 if it is not already
 * running. Safe to call repeatedly from multiple plugin init paths. Handles
 * EADDRINUSE by assuming another gateway instance already started the shim.
 */
export function ensureShimStarted(): Promise<void> {
  if (shimState) {
    return Promise.resolve();
  }
  if (startPromise) {
    return startPromise;
  }
  startPromise = startShim().finally(() => {
    startPromise = null;
  });
  return startPromise;
}

function startShim(): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      void handleRequest(req, res).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[zero-api shim] unhandled request error:", message);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: { message, type: "shim_error" } }));
        } else {
          try {
            res.end();
          } catch {
            // already torn down
          }
        }
      });
    });

    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        // Another gateway instance already owns the port; treat as success.
        console.warn(
          `[zero-api shim] 127.0.0.1:${SHIM_PORT} already in use, assuming another gateway owns it.`,
        );
        shimState = null;
        resolve();
        return;
      }
      reject(err);
    });

    server.listen(SHIM_PORT, SHIM_HOST, () => {
      const addr = server.address() as AddressInfo | null;
      const port = addr?.port ?? SHIM_PORT;
      console.info(`[zero-api shim] listening on http://${SHIM_HOST}:${port}${ROUTE_PREFIX}`);
      shimState = { server, startedAt: Date.now() };
      resolve();
    });
  });
}

type ParsedRoute = {
  handler: ZeroApiHandler;
  subPath: string;
};

function parseRoute(url: string): ParsedRoute | null {
  if (!url.startsWith(`${ROUTE_PREFIX}/`)) {
    return null;
  }
  const rest = url.slice(ROUTE_PREFIX.length + 1).split("?")[0] ?? "";
  // rest looks like "deepseek-web/chat/completions" or "qwen-web/models"
  const slash = rest.indexOf("/");
  const providerId = slash === -1 ? rest : rest.slice(0, slash);
  const subPath = slash === -1 ? "" : rest.slice(slash); // "/chat/completions" or "/models"
  if (!providerId) {
    return null;
  }
  const handler = getShimHandler(providerId);
  if (!handler) {
    return null;
  }
  return { handler, subPath };
}

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = req.url ?? "/";
  const route = parseRoute(url);
  if (!route) {
    res.statusCode = 404;
    res.end();
    return;
  }

  if (req.method === "GET" && route.subPath === "/models") {
    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        object: "list",
        data: route.handler.modelIds.map((id) => ({
          id,
          object: "model",
          created: 0,
          owned_by: "zero-api",
        })),
      }),
    );
    return;
  }

  if (req.method === "POST" && route.subPath === "/chat/completions") {
    await handleChatCompletions(route.handler, req, res);
    return;
  }

  res.statusCode = 404;
  res.end();
}

type IncomingChatRequest = {
  model?: string;
  messages?: ZeroApiIncomingMessage[];
  stream?: boolean;
};

async function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer | string) => {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    });
    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", reject);
  });
}

function coerceMessageText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const part of content) {
      if (part && typeof part === "object" && "text" in part) {
        const text = (part as { text?: unknown }).text;
        if (typeof text === "string") {
          parts.push(text);
        }
      }
    }
    return parts.join("");
  }
  return "";
}

function buildPromptFromMessages(messages: ZeroApiIncomingMessage[]): string {
  const lines: string[] = [];
  for (const message of messages) {
    const raw = coerceMessageText(message.content);
    const cleaned = stripInboundMeta(raw);
    if (!cleaned) {
      continue;
    }
    const role = message.role;
    if (role === "system") {
      lines.push(`System: ${cleaned}`);
    } else if (role === "assistant") {
      lines.push(`Assistant: ${cleaned}`);
    } else {
      lines.push(`User: ${cleaned}`);
    }
  }
  return lines.join("\n\n");
}

function sendSseHeaders(res: http.ServerResponse): void {
  res.statusCode = 200;
  res.setHeader("content-type", "text/event-stream");
  res.setHeader("cache-control", "no-cache, no-transform");
  res.setHeader("connection", "keep-alive");
  res.flushHeaders?.();
}

function writeChunk(res: http.ServerResponse, payload: string): void {
  res.write(payload);
}

async function handleChatCompletions(
  handler: ZeroApiHandler,
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  let raw: string;
  try {
    raw = await readBody(req);
  } catch (err: unknown) {
    res.statusCode = 400;
    res.end(err instanceof Error ? err.message : "failed to read body");
    return;
  }

  let parsed: IncomingChatRequest;
  try {
    parsed = JSON.parse(raw) as IncomingChatRequest;
  } catch {
    res.statusCode = 400;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: { message: "invalid json body", type: "bad_request" } }));
    return;
  }

  const model =
    typeof parsed.model === "string" ? parsed.model : (handler.modelIds[0] ?? handler.id);
  const messages = Array.isArray(parsed.messages) ? parsed.messages : [];
  const prompt = buildPromptFromMessages(messages);
  if (!prompt) {
    res.statusCode = 400;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: { message: "no prompt in request", type: "bad_request" } }));
    return;
  }

  try {
    const stream = await handler.handleChat({
      messages,
      prompt,
      model,
      stream: parsed.stream !== false,
    });

    sendSseHeaders(res);
    const chunkId = buildChunkId();
    writeChunk(res, encodeChunk(buildRoleStartChunk(chunkId, model)));

    for await (const delta of stream) {
      if (delta.reasoning) {
        writeChunk(
          res,
          encodeChunk(
            buildDeltaChunk({
              id: chunkId,
              model,
              delta: { reasoning_content: delta.reasoning },
            }),
          ),
        );
      }
      if (delta.text) {
        writeChunk(
          res,
          encodeChunk(
            buildDeltaChunk({
              id: chunkId,
              model,
              delta: { content: delta.text },
            }),
          ),
        );
      }
    }

    writeChunk(res, encodeChunk(buildStopChunk(chunkId, model)));
    writeChunk(res, SSE_DONE);
    res.end();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[zero-api shim] ${handler.id} upstream error:`, message);
    if (!res.headersSent) {
      res.statusCode = 502;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: { message, type: "upstream_error" } }));
      return;
    }
    writeChunk(
      res,
      encodeChunk(
        buildDeltaChunk({
          id: buildChunkId(),
          model,
          delta: { content: `\n[zero-api error] ${message}` },
          finishReason: "stop",
        }),
      ),
    );
    writeChunk(res, SSE_DONE);
    res.end();
  }
}
