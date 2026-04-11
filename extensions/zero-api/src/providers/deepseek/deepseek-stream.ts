/**
 * Minimal DeepSeek Web SSE parser.
 *
 * The upstream reference implementation targets the pi-agent-core event
 * stream and carries a very large amount of tag-splitting / tool-call
 * logic. The shim only needs to translate DeepSeek SSE events into plain
 * `{ text?, reasoning? }` deltas; OpenAI-chunk framing is handled in
 * `shim/openai-compat.ts`.
 *
 * Path-based deltas:
 *   - `data.p` containing "reasoning" → thinking chunk
 *   - `data.p` containing "content" / "choices" → text chunk
 *   - `data.type === "thinking" | "text"` → explicit channel
 *   - OpenAI-shaped `choices[0].delta` fallback for any stray shapes
 *
 * Junk tokens from DeepSeek's thinking channel (various Unicode variants of
 * `<|end_of_thinking|>`) are filtered out.
 */

export type DeepSeekDelta = {
  text?: string;
  reasoning?: string;
};

const JUNK_TOKENS = new Set<string>([
  "<｜end▁of▁thinking｜>",
  "<|end▁of▁thinking|>",
  "<｜end_of_thinking｜>",
  "<|end_of_thinking|>",
  "<|endoftext|>",
]);

type DeepSeekSseEvent = {
  p?: string;
  v?: unknown;
  type?: string;
  content?: string;
  response_message_id?: string | number;
  choices?: Array<{
    delta?: {
      content?: string;
      reasoning_content?: string;
    };
  }>;
};

function pushDelta(out: DeepSeekDelta[], channel: "text" | "reasoning", value: string): void {
  if (!value || JUNK_TOKENS.has(value)) {
    return;
  }
  if (channel === "text") {
    out.push({ text: value });
  } else {
    out.push({ reasoning: value });
  }
}

/**
 * Decode one `data: {...}` SSE payload into zero or more deltas.
 *
 * The parser intentionally swallows unrecognized payload shapes; the server
 * emits a lot of metadata/keepalive events that we do not need to translate.
 */
export function decodeDeepSeekEvent(dataStr: string): DeepSeekDelta[] {
  if (!dataStr || dataStr === "[DONE]") {
    return [];
  }
  let data: DeepSeekSseEvent;
  try {
    data = JSON.parse(dataStr) as DeepSeekSseEvent;
  } catch {
    return [];
  }
  const out: DeepSeekDelta[] = [];

  // 1. Reasoning channel.
  if ((data.p?.includes("reasoning") || data.type === "thinking") && typeof data.v === "string") {
    pushDelta(out, "reasoning", data.v);
    return out;
  }
  if (data.type === "thinking" && typeof data.content === "string") {
    pushDelta(out, "reasoning", data.content);
    return out;
  }

  // 2. Text channel (direct string value on content/choices paths).
  if (
    typeof data.v === "string" &&
    (!data.p || data.p.includes("content") || data.p.includes("choices"))
  ) {
    pushDelta(out, "text", data.v);
    return out;
  }
  if (data.type === "text" && typeof data.content === "string") {
    pushDelta(out, "text", data.content);
    return out;
  }

  // 3. Array fragments on data.v.
  if (Array.isArray(data.v)) {
    for (const raw of data.v) {
      if (!raw || typeof raw !== "object") continue;
      const frag = raw as { type?: string; content?: string };
      if (frag.type === "THINKING" || frag.type === "reasoning") {
        pushDelta(out, "reasoning", frag.content || "");
      } else if (typeof frag.content === "string") {
        pushDelta(out, "text", frag.content);
      }
    }
    return out;
  }

  // 4. Nested response.fragments (session init).
  const fragmentsHolder = data.v as { response?: { fragments?: unknown[] } } | undefined;
  const fragments = fragmentsHolder?.response?.fragments;
  if (Array.isArray(fragments)) {
    for (const raw of fragments) {
      if (!raw || typeof raw !== "object") continue;
      const frag = raw as { type?: string; content?: string };
      if (frag.type === "THINKING" || frag.type === "reasoning") {
        pushDelta(out, "reasoning", frag.content || "");
      } else if (typeof frag.content === "string") {
        pushDelta(out, "text", frag.content);
      }
    }
    return out;
  }

  // 5. Standard OpenAI-like fallback.
  const choice = data.choices?.[0];
  if (choice?.delta) {
    if (typeof choice.delta.reasoning_content === "string") {
      pushDelta(out, "reasoning", choice.delta.reasoning_content);
    }
    if (typeof choice.delta.content === "string") {
      pushDelta(out, "text", choice.delta.content);
    }
  }
  return out;
}

/**
 * Async iterator that consumes a DeepSeek Web SSE ReadableStream and yields
 * normalized deltas in order. Handles line buffering and SSE framing.
 */
export async function* iterateDeepSeekStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<DeepSeekDelta, void, void> {
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
      // best effort
    }
  }
}

function* decodeLine(line: string): Generator<DeepSeekDelta, void, void> {
  if (!line || line.startsWith("event:") || line.startsWith(":")) {
    return;
  }
  if (!line.startsWith("data:")) {
    return;
  }
  const payload = line.slice(5).trim();
  for (const delta of decodeDeepSeekEvent(payload)) {
    yield delta;
  }
}
