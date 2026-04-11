/**
 * Minimal MiMo Web SSE parser.
 *
 * Upstream xiaomimo-web-stream.ts targets the pi-agent-core event stream and
 * carries tag-splitting / tool-call logic. The shim only needs to translate
 * MiMo SSE events into plain `{ text?, reasoning? }` deltas.
 *
 * MiMo event shape is `{"type":"text","content":"..."}` per `data:` line.
 * The `content` field may contain `<think>...</think>` blocks that we route
 * to the reasoning channel. Null bytes and zero-width chars are filtered.
 */

export type MimoDelta = {
  text?: string;
  reasoning?: string;
};

type MimoSseEvent = {
  type?: string;
  content?: string;
  text?: string;
  delta?: string;
  sessionId?: string;
  choices?: Array<{
    delta?: {
      content?: string;
      reasoning_content?: string;
    };
  }>;
};

const JUNK_REGEX = /[\u0000\u200B-\u200D\uFEFF]/g;

function clean(value: string): string {
  return value.replace(JUNK_REGEX, "");
}

/**
 * Decode one SSE payload. Maintains inside-thinking state across calls via
 * the passed-in `state` object (per-iterator closure).
 */
type DecoderState = {
  insideThink: boolean;
  accumulated: string;
  currentEvent: string;
};

function createState(): DecoderState {
  return { insideThink: false, accumulated: "", currentEvent: "" };
}

function splitThink(raw: string, state: DecoderState): MimoDelta[] {
  let content = raw;
  const out: MimoDelta[] = [];

  // Walk the string, toggling between text and reasoning on <think>/</think>.
  while (content.length > 0) {
    if (state.insideThink) {
      const endIdx = content.indexOf("</think>");
      if (endIdx === -1) {
        if (content) out.push({ reasoning: content });
        return out;
      }
      const before = content.slice(0, endIdx);
      if (before) out.push({ reasoning: before });
      content = content.slice(endIdx + "</think>".length);
      state.insideThink = false;
    } else {
      const startIdx = content.indexOf("<think>");
      if (startIdx === -1) {
        if (content) out.push({ text: content });
        return out;
      }
      const before = content.slice(0, startIdx);
      if (before) out.push({ text: before });
      content = content.slice(startIdx + "<think>".length);
      state.insideThink = true;
    }
  }
  return out;
}

function decodeMimoDataPayload(dataStr: string, state: DecoderState): MimoDelta[] {
  if (!dataStr || dataStr === "[DONE]") return [];
  let data: MimoSseEvent;
  try {
    data = JSON.parse(dataStr) as MimoSseEvent;
  } catch {
    // Some events are plain text; emit as text if non-JSON and non-empty.
    if (!dataStr.startsWith("{")) {
      return [{ text: clean(dataStr) }];
    }
    return [];
  }

  // Skip non-message SSE events.
  if (state.currentEvent && state.currentEvent !== "message") {
    return [];
  }

  if (typeof data.content === "string" && data.content.length > 0) {
    const cleaned = clean(data.content);
    if (!cleaned) return [];
    return splitThink(cleaned, state);
  }

  // OpenAI fallback: full content dedup.
  const delta = data.choices?.[0]?.delta;
  if (delta) {
    const out: MimoDelta[] = [];
    if (typeof delta.reasoning_content === "string" && delta.reasoning_content) {
      out.push({ reasoning: clean(delta.reasoning_content) });
    }
    if (typeof delta.content === "string" && delta.content) {
      out.push({ text: clean(delta.content) });
    }
    return out;
  }

  const rawDelta = data.text ?? data.delta;
  if (typeof rawDelta === "string" && rawDelta) {
    // OpenAI-style full-content replays: only emit the new tail.
    if (rawDelta.length > state.accumulated.length) {
      const tail = rawDelta.slice(state.accumulated.length);
      state.accumulated = rawDelta;
      if (tail) return splitThink(clean(tail), state);
    }
  }
  return [];
}

export async function* iterateMimoStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<MimoDelta, void, void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const state = createState();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        const tail = buffer.trim();
        if (tail) {
          for (const line of tail.split("\n")) {
            yield* decodeLine(line.trim(), state);
          }
        }
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";
      for (const line of parts) {
        yield* decodeLine(line.trim(), state);
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

function* decodeLine(line: string, state: DecoderState): Generator<MimoDelta, void, void> {
  if (!line || line.startsWith(":")) return;
  if (line.startsWith("event:")) {
    state.currentEvent = line.slice(6).trim();
    return;
  }
  if (!line.startsWith("data:")) return;
  const payload = line.slice(5).trim();
  for (const delta of decodeMimoDataPayload(payload, state)) {
    yield delta;
  }
}
