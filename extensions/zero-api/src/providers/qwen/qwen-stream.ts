/**
 * Minimal Qwen Web SSE parser.
 *
 * Qwen's `/api/v2/chat/completions` emits an OpenAI-style SSE stream whose
 * payloads look like:
 *   data: {"choices":[{"delta":{"content":"hello"}}]}
 *
 * Phase-tagged payloads also appear when `thinking_enabled` is on; those use
 * `choices[0].delta.phase === "think"` or carry content under
 * `choices[0].delta.reasoning_content`. We normalize both to `{text?, reasoning?}`
 * and drop everything else (usage events, keepalives, metadata, etc.).
 */

export type QwenDelta = {
  text?: string;
  reasoning?: string;
};

type QwenSseEvent = {
  choices?: Array<{
    delta?: {
      content?: string;
      reasoning_content?: string;
      phase?: string;
      status?: string;
    };
  }>;
  text?: string;
  content?: string;
  delta?: string;
};

function pushText(out: QwenDelta[], value: string | undefined): void {
  if (typeof value === "string" && value.length > 0) {
    out.push({ text: value });
  }
}

function pushReasoning(out: QwenDelta[], value: string | undefined): void {
  if (typeof value === "string" && value.length > 0) {
    out.push({ reasoning: value });
  }
}

export function decodeQwenEvent(dataStr: string): QwenDelta[] {
  if (!dataStr || dataStr === "[DONE]") return [];
  let data: QwenSseEvent;
  try {
    data = JSON.parse(dataStr) as QwenSseEvent;
  } catch {
    return [];
  }
  const out: QwenDelta[] = [];
  const choice = data.choices?.[0];
  if (choice?.delta) {
    const delta = choice.delta;
    if (typeof delta.reasoning_content === "string") {
      pushReasoning(out, delta.reasoning_content);
    }
    if (typeof delta.content === "string") {
      if (delta.phase === "think") {
        pushReasoning(out, delta.content);
      } else {
        pushText(out, delta.content);
      }
    }
    if (out.length > 0) return out;
  }
  pushText(out, data.text ?? data.content ?? data.delta);
  return out;
}

export async function* iterateQwenStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<QwenDelta, void, void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        const tail = buffer.trim();
        if (tail) {
          for (const line of tail.split("\n")) {
            yield* decodeLine(line.trim());
          }
        }
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";
      for (const line of parts) {
        yield* decodeLine(line.trim());
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

function* decodeLine(line: string): Generator<QwenDelta, void, void> {
  if (!line || line.startsWith("event:") || line.startsWith(":")) return;
  if (!line.startsWith("data:")) return;
  const payload = line.slice(5).trim();
  for (const delta of decodeQwenEvent(payload)) {
    yield delta;
  }
}
