/**
 * Minimal Kimi Web SSE parser.
 *
 * The Kimi client runs the Connect-RPC fetch inside a Playwright page,
 * collects the full assistant text, and wraps it as a single-frame SSE
 * stream so the parser stays uniform with other providers. The payload
 * shape we expect is:
 *
 *   data: {"text":"hello"}
 *   data: [DONE]
 */

export type KimiDelta = {
  text?: string;
  reasoning?: string;
};

type KimiSseFrame = {
  text?: string;
  content?: string;
  delta?: string;
  choices?: Array<{ delta?: { content?: string } }>;
};

function pushText(out: KimiDelta[], value: unknown): void {
  if (typeof value === "string" && value.length > 0) {
    out.push({ text: value });
  }
}

export function decodeKimiEvent(dataStr: string): KimiDelta[] {
  if (!dataStr || dataStr === "[DONE]") return [];
  let data: KimiSseFrame;
  try {
    data = JSON.parse(dataStr) as KimiSseFrame;
  } catch {
    return [];
  }
  const out: KimiDelta[] = [];
  pushText(out, data.text);
  if (out.length === 0) pushText(out, data.content);
  if (out.length === 0) pushText(out, data.delta);
  if (out.length === 0) pushText(out, data.choices?.[0]?.delta?.content);
  return out;
}

export async function* iterateKimiStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<KimiDelta, void, void> {
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

function* decodeLine(line: string): Generator<KimiDelta, void, void> {
  if (!line || line.startsWith("event:") || line.startsWith(":")) return;
  if (!line.startsWith("data:")) return;
  const payload = line.slice(5).trim();
  for (const delta of decodeKimiEvent(payload)) {
    yield delta;
  }
}
