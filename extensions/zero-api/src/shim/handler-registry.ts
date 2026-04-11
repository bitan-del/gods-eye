/**
 * Generic handler registry for the zero-api OpenAI-compat shim.
 *
 * Each browser-session provider registers a `ZeroApiHandler` that knows how
 * to (a) list its own model ids, and (b) translate an incoming chat request
 * into an async iterable of normalized `{ text?, reasoning? }` deltas. The
 * shim's HTTP server dispatches requests to handlers by path prefix and
 * handles OpenAI-compat SSE framing around the handler output.
 */

export type ZeroApiDelta = {
  text?: string;
  reasoning?: string;
};

export type ZeroApiIncomingMessage = {
  role: string;
  content: unknown;
};

export type ZeroApiChatRequest = {
  /** Full list of messages the caller sent (already parsed). */
  messages: ZeroApiIncomingMessage[];
  /** Flattened "System: ...\n\nUser: ..." prompt built from `messages`. */
  prompt: string;
  /** The model id the caller asked for. */
  model: string;
  /** Whether the caller wants streaming (always true for Gods Eye). */
  stream: boolean;
};

export type ZeroApiStreamResult = AsyncIterable<ZeroApiDelta>;

export type ZeroApiHandler = {
  /** Canonical provider id, e.g. "deepseek-web", "qwen-web". */
  id: string;
  /** Human-readable label used in log prefixes. */
  label: string;
  /** Model ids this handler exposes. */
  modelIds: string[];
  /**
   * Run a single chat completion. Implementations are expected to:
   *   1. Resolve credentials (calling the provider's own interactive login
   *      flow when missing or expired).
   *   2. Make the upstream web-session call.
   *   3. Yield normalized deltas until the upstream stream finishes.
   * Auth failures should throw errors whose message contains "401" or "403"
   * so the shim can re-run the login flow and retry once.
   */
  handleChat(request: ZeroApiChatRequest): Promise<ZeroApiStreamResult>;
};

const handlers = new Map<string, ZeroApiHandler>();

export function registerShimHandler(handler: ZeroApiHandler): void {
  handlers.set(handler.id, handler);
}

export function getShimHandler(id: string): ZeroApiHandler | undefined {
  return handlers.get(id);
}

export function listShimHandlers(): ZeroApiHandler[] {
  return Array.from(handlers.values());
}
