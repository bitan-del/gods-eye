/**
 * Doubao (www.doubao.com) SSE decoder.
 *
 * Doubao's samantha chat API streams events in the shape:
 *
 *   data: {"event_type": 2001, "event_data": "{\"message\": {\"content\": \"{\\\"text\\\": \\\"...\\\"}\"}}" }
 *
 * where:
 *   - event_type 2001 = message content (incremental delta inside the
 *     doubly-JSON-encoded `message.content.text` field).
 *   - event_type 2002 / 2003 / 2010 = various lifecycle events.
 *
 * Doubao sends incremental new text on each event (not accumulated
 * totals), so we push each delta as-is. The upstream reference parser
 * also handles `<think>...</think>` wrapping and tool-call XML, but the
 * shim layer does not need those — we emit plain `text` deltas and
 * treat `<think>` content as reasoning when we detect it.
 *
 * Legacy fallback fields: `choices[0].delta.content`, `text`,
 * `content`, `delta`.
 */

export type DoubaoDelta = {
  text?: string;
  reasoning?: string;
};

type DoubaoSseEvent = {
  event_type?: number;
  event_data?: string | Record<string, unknown>;
  text?: string;
  content?: string;
  delta?: string;
  choices?: Array<{
    delta?: { content?: string; reasoning_content?: string };
  }>;
};

function extractDelta(data: DoubaoSseEvent): string {
  if (data.event_data) {
    let eventData: Record<string, unknown>;
    if (typeof data.event_data === "string") {
      try {
        eventData = JSON.parse(data.event_data) as Record<string, unknown>;
      } catch {
        eventData = {};
      }
    } else {
      eventData = data.event_data;
    }
    if (data.event_type === 2001) {
      const msg = eventData["message"] as Record<string, unknown> | undefined;
      const contentRaw = msg?.["content"];
      if (typeof contentRaw === "string") {
        try {
          const contentObj = JSON.parse(contentRaw) as { text?: string };
          if (typeof contentObj.text === "string") return contentObj.text;
        } catch {
          /* ignore */
        }
      }
    } else if (data.event_type === 2003) {
      const t = eventData["text"];
      const c = eventData["content"];
      const d = eventData["delta"];
      if (typeof t === "string") return t;
      if (typeof c === "string") return c;
      if (typeof d === "string") return d;
    }
  }
  const choice = data.choices?.[0];
  if (choice?.delta && typeof choice.delta.content === "string") return choice.delta.content;
  if (typeof data.text === "string") return data.text;
  if (typeof data.content === "string") return data.content;
  if (typeof data.delta === "string") return data.delta;
  return "";
}

export async function* iterateDoubaoStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<DoubaoDelta, void, void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  // Tracks whether we're currently inside a <think>...</think> block so
  // that text emitted during that span is routed to the `reasoning`
  // channel instead of `text`.
  let inThink = false;
  let tagBuffer = "";

  const emitText = function* (raw: string): Generator<DoubaoDelta, void, void> {
    if (!raw) return;
    tagBuffer += raw;
    while (tagBuffer.length > 0) {
      if (inThink) {
        const endIdx = tagBuffer.search(/<\/think\b[^<>]*>/i);
        if (endIdx === -1) {
          // All tagBuffer is thinking content; hold back any trailing
          // partial tag ("<" … ) so we don't emit half of a close tag.
          const lastAngle = tagBuffer.lastIndexOf("<");
          if (lastAngle === -1) {
            yield { reasoning: tagBuffer };
            tagBuffer = "";
          } else if (lastAngle === 0) {
            return; // wait for more
          } else {
            yield { reasoning: tagBuffer.slice(0, lastAngle) };
            tagBuffer = tagBuffer.slice(lastAngle);
            return;
          }
        } else {
          if (endIdx > 0) yield { reasoning: tagBuffer.slice(0, endIdx) };
          const match = tagBuffer.slice(endIdx).match(/<\/think\b[^<>]*>/i);
          const consumed = endIdx + (match?.[0].length ?? 0);
          tagBuffer = tagBuffer.slice(consumed);
          inThink = false;
        }
      } else {
        const startMatch = tagBuffer.match(/<think\b[^<>]*>/i);
        if (!startMatch) {
          const lastAngle = tagBuffer.lastIndexOf("<");
          if (lastAngle === -1) {
            yield { text: tagBuffer };
            tagBuffer = "";
          } else if (lastAngle === 0) {
            return; // wait for more
          } else {
            yield { text: tagBuffer.slice(0, lastAngle) };
            tagBuffer = tagBuffer.slice(lastAngle);
            return;
          }
        } else {
          const idx = startMatch.index ?? 0;
          if (idx > 0) yield { text: tagBuffer.slice(0, idx) };
          tagBuffer = tagBuffer.slice(idx + startMatch[0].length);
          inThink = true;
        }
      }
    }
  };

  const processLine = function* (line: string): Generator<DoubaoDelta, void, void> {
    if (!line || !line.startsWith("data:")) return;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") return;
    let data: DoubaoSseEvent;
    try {
      data = JSON.parse(payload) as DoubaoSseEvent;
    } catch {
      return;
    }
    const delta = extractDelta(data);
    if (delta) yield* emitText(delta);
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        const tail = buffer.trim();
        if (tail) {
          for (const line of tail.split("\n")) yield* processLine(line.trim());
        }
        if (tagBuffer) {
          if (inThink) yield { reasoning: tagBuffer };
          else yield { text: tagBuffer };
          tagBuffer = "";
        }
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";
      for (const line of parts) yield* processLine(line.trim());
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* best effort */
    }
  }
}
