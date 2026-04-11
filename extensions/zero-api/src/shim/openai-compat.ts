/**
 * Small helpers for serializing OpenAI-compatible chat-completion chunks.
 *
 * The shim only ever streams, so we always emit `chat.completion.chunk`
 * envelopes followed by the terminal `[DONE]` sentinel.
 */

export type OpenAiChunkDelta = {
  role?: "assistant";
  content?: string;
  reasoning_content?: string;
};

export type OpenAiChunk = {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: Array<{
    index: 0;
    delta: OpenAiChunkDelta;
    finish_reason: string | null;
  }>;
};

export function buildChunkId(): string {
  return `zeroapi-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

export function encodeChunk(chunk: OpenAiChunk): string {
  return `data: ${JSON.stringify(chunk)}\n\n`;
}

export function buildDeltaChunk(params: {
  id: string;
  model: string;
  delta: OpenAiChunkDelta;
  finishReason?: string | null;
}): OpenAiChunk {
  return {
    id: params.id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: params.model,
    choices: [
      {
        index: 0,
        delta: params.delta,
        finish_reason: params.finishReason ?? null,
      },
    ],
  };
}

export function buildRoleStartChunk(id: string, model: string): OpenAiChunk {
  return buildDeltaChunk({ id, model, delta: { role: "assistant", content: "" } });
}

export function buildStopChunk(id: string, model: string): OpenAiChunk {
  return buildDeltaChunk({ id, model, delta: {}, finishReason: "stop" });
}

export const SSE_DONE = "data: [DONE]\n\n";
