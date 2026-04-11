/**
 * Qwen CN Web SSE parser.
 *
 * Qwen CN's `/api/v2/chat` stream emits JSON frames where the accumulated
 * assistant reply lives at `data.data.messages[last].content`. Because the
 * server sends the FULL running text on every frame (not incremental
 * deltas), we track the last extracted content and only emit the new
 * suffix.
 */

export type QwenCnDelta = {
  text?: string;
  reasoning?: string;
};

type QwenCnSseFrame = {
  data?: {
    messages?: Array<{ content?: unknown; role?: string }>;
    text?: string;
    content?: string;
    delta?: string;
  };
  communication?: { text?: string; content?: string };
  text?: string;
  content?: string;
  delta?: string;
  choices?: Array<{ delta?: { content?: string } }>;
};

function extractFrameContent(frame: QwenCnSseFrame): string | undefined {
  const messages = frame.data?.messages;
  if (Array.isArray(messages)) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg && typeof msg.content === "string" && msg.content.length > 0) {
        return msg.content;
      }
    }
  }
  const viaChoices = frame.choices?.[0]?.delta?.content;
  if (typeof viaChoices === "string") return viaChoices;
  const viaData =
    (typeof frame.data?.text === "string" && frame.data.text) ||
    (typeof frame.data?.content === "string" && frame.data.content) ||
    (typeof frame.data?.delta === "string" && frame.data.delta) ||
    undefined;
  if (viaData) return viaData;
  const viaComms =
    (typeof frame.communication?.text === "string" && frame.communication.text) ||
    (typeof frame.communication?.content === "string" && frame.communication.content) ||
    undefined;
  if (viaComms) return viaComms;
  return (
    (typeof frame.text === "string" && frame.text) ||
    (typeof frame.content === "string" && frame.content) ||
    (typeof frame.delta === "string" && frame.delta) ||
    undefined
  );
}

export async function* iterateQwenCnStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<QwenCnDelta, void, void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let lastAccum = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        const tail = buffer.trim();
        if (tail) {
          for (const line of tail.split("\n")) {
            const d = processLine(line.trim(), lastAccum);
            if (d) {
              lastAccum = d.accum;
              if (d.delta) yield { text: d.delta };
            }
          }
        }
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";
      for (const line of parts) {
        const d = processLine(line.trim(), lastAccum);
        if (d) {
          lastAccum = d.accum;
          if (d.delta) yield { text: d.delta };
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* best effort */
    }
  }
}

function processLine(line: string, lastAccum: string): { delta: string; accum: string } | null {
  if (!line || line.startsWith("event:") || line.startsWith(":")) return null;
  if (!line.startsWith("data:")) return null;
  const payload = line.slice(5).trim();
  if (!payload || payload === "[DONE]") return null;
  let frame: QwenCnSseFrame;
  try {
    frame = JSON.parse(payload) as QwenCnSseFrame;
  } catch {
    return null;
  }
  const content = extractFrameContent(frame);
  if (typeof content !== "string" || content.length === 0) return null;
  // Qwen CN emits accumulated text on every frame; only emit the new suffix.
  if (content.length > lastAccum.length && content.startsWith(lastAccum)) {
    return { delta: content.slice(lastAccum.length), accum: content };
  }
  if (content !== lastAccum) {
    // Completely new message — emit as-is.
    return { delta: content, accum: content };
  }
  return { delta: "", accum: lastAccum };
}
