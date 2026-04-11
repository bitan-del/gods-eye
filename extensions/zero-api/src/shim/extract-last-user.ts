import type { ZeroApiIncomingMessage } from "./handler-registry.js";

/**
 * Extract the last user turn from an incoming chat request as a plain string.
 *
 * DOM-automation providers (ChatGPT Web, Gemini Web, GLM Web) type the
 * prompt into the site's composer. Sending the full flattened
 * "System: ...\nUser: ...\nAssistant: ..." history would dump the whole
 * conversation into the composer every turn — which is wrong in two ways:
 *   1. The upstream site already holds the real conversation history
 *      (persistent Chrome profile keeps the same thread alive across
 *      requests), so replaying prior turns duplicates context.
 *   2. It exposes the internal Gods Eye system prompt and status-line
 *      metadata to the upstream model.
 *
 * We walk `messages` from the end and return the concatenated string
 * content of the last message whose role is "user". Non-string content
 * parts (e.g. OpenAI content arrays) are joined by concatenating any
 * `text` fields we find. If no user message is present we fall back to the
 * shim's flattened prompt.
 */
export function extractLastUserMessage(
  messages: ZeroApiIncomingMessage[],
  fallback: string,
): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg || msg.role !== "user") continue;
    const text = stripGodsEyeChannelMetadata(stringifyContent(msg.content));
    if (text.trim().length > 0) return text;
  }
  return stripGodsEyeChannelMetadata(fallback);
}

/**
 * Strip Gods Eye channel/agent metadata prefixes that the gateway attaches
 * to user turns before they reach providers. Without this, the
 * `\`\`\`json{...}\`\`\`[timestamp] <text>` wrapper gets typed verbatim into
 * the upstream site's composer (visible in ChatGPT Web as the metadata blob
 * + timestamp + user text).
 *
 * Handles (in order, repeatedly until nothing matches):
 *   1. A leading fenced `\`\`\`json { ... } \`\`\`` block carrying channel
 *      metadata (label/id/etc).
 *   2. A leading `[YYYY-MM-DD ...]` or `[Sat 2026-04-11 ...]` style bracket
 *      timestamp, optionally prefixed by "Sender (untrusted metadata):" style
 *      labels the agent uses.
 *   3. Leading "Sender (...)" / "User:" / "Assistant:" style role labels.
 */
export function stripGodsEyeChannelMetadata(text: string): string {
  if (typeof text !== "string" || text.length === 0) return text;
  let out = text;
  // Iterate because prefixes can stack (json fence + bracket timestamp).
  for (let i = 0; i < 6; i++) {
    const before = out;
    out = out.replace(/^\s*```json\s*\{[^]*?\}\s*```/i, "");
    out = out.replace(/^\s*\[[^\]\n]{3,80}\]\s*/, "");
    out = out.replace(/^\s*Sender\s*\([^)]*\)\s*:?\s*/i, "");
    out = out.replace(/^\s*(User|Assistant|System)\s*:\s*/i, "");
    if (out === before) break;
  }
  return out.trim().length > 0 ? out : text;
}

function stringifyContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const item of content) {
      if (typeof item === "string") {
        parts.push(item);
        continue;
      }
      if (item && typeof item === "object") {
        const rec = item as Record<string, unknown>;
        const t = rec.text ?? rec.content ?? rec.value;
        if (typeof t === "string") parts.push(t);
      }
    }
    return parts.join("\n");
  }
  if (content && typeof content === "object") {
    const rec = content as Record<string, unknown>;
    const t = rec.text ?? rec.content ?? rec.value;
    if (typeof t === "string") return t;
  }
  return "";
}
