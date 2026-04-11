/**
 * ChatGLM CN (chatglm.cn) SSE decoder.
 *
 * The real backend endpoint
 *   POST https://chatglm.cn/chatglm/backend-api/assistant/stream
 * returns `data: {...}` SSE events where each event ships the FULL
 * accumulated content so far, not an incremental delta. We diff against
 * the previously emitted string to produce deltas.
 *
 * Event shape (observed):
 *   {
 *     conversation_id: "...",
 *     parts: [
 *       { content: [{ type: "text", text: "<full so far>" }] }
 *     ]
 *   }
 *
 * Legacy fallback fields: `text`, `content`, `delta`.
 */

export type GlmCnDelta = {
  text?: string;
  reasoning?: string;
};

type GlmCnSseEvent = {
  conversation_id?: string;
  text?: string;
  content?: string;
  delta?: string;
  parts?: Array<{
    content?: Array<{ type?: string; text?: string }>;
  }>;
};

function extractAccumulated(data: GlmCnSseEvent): string {
  if (Array.isArray(data.parts)) {
    for (const part of data.parts) {
      const content = part?.content;
      if (Array.isArray(content)) {
        for (const c of content) {
          if (c?.type === "text" && typeof c.text === "string") return c.text;
        }
      }
    }
  }
  if (typeof data.text === "string") return data.text;
  if (typeof data.content === "string") return data.content;
  if (typeof data.delta === "string") return data.delta;
  return "";
}

export async function* iterateGlmCnStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<GlmCnDelta, void, void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let emitted = "";

  const process = function* (line: string): Generator<GlmCnDelta, void, void> {
    if (!line || !line.startsWith("data:")) return;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") return;
    let data: GlmCnSseEvent;
    try {
      data = JSON.parse(payload) as GlmCnSseEvent;
    } catch {
      return;
    }
    const acc = extractAccumulated(data);
    if (acc && acc.length > emitted.length) {
      const delta = acc.slice(emitted.length);
      emitted = acc;
      if (delta) yield { text: delta };
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        const tail = buffer.trim();
        if (tail) {
          for (const line of tail.split("\n")) yield* process(line.trim());
        }
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";
      for (const line of parts) yield* process(line.trim());
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* best effort */
    }
  }
}
