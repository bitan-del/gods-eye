import {
  registerShimHandler,
  type ZeroApiChatRequest,
  type ZeroApiStreamResult,
} from "../../shim/handler-registry.js";
import {
  loadDoubaoWebCredentials,
  formatCookieHeader,
  type DoubaoWebCredentials,
} from "./doubao-auth.js";
import { DoubaoWebClient, type DoubaoWebClientOptions } from "./doubao-client.js";
import { ensureDoubaoWebLogin } from "./doubao-login.js";
import { iterateDoubaoStream } from "./doubao-stream.js";
import { DOUBAO_WEB_MODEL_CATALOG } from "./models.js";

function isAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /\b(401|403)\b/.test(msg) || /unauthori[sz]ed/i.test(msg);
}

async function resolveCredentials(): Promise<DoubaoWebCredentials> {
  const existing = await loadDoubaoWebCredentials();
  if (existing) return existing;
  console.info("[zero-api doubao-web] Doubao credentials missing; launching browser login flow...");
  return ensureDoubaoWebLogin();
}

function buildClient(c: DoubaoWebCredentials): DoubaoWebClient {
  const cookieHeader = formatCookieHeader(c.cookies);
  const opts: DoubaoWebClientOptions = {
    sessionid: c.sessionid,
    ...(cookieHeader ? { cookie: cookieHeader } : {}),
    ...(c.ttwid ? { ttwid: c.ttwid } : {}),
    ...(c.userAgent ? { userAgent: c.userAgent } : {}),
  };
  return new DoubaoWebClient(opts);
}

async function openUpstream(
  c: DoubaoWebCredentials,
  prompt: string,
  model: string,
): Promise<{ client: DoubaoWebClient; stream: ReadableStream<Uint8Array> }> {
  const client = buildClient(c);
  await client.init();
  const stream = await client.chatCompletions({ message: prompt, model });
  return { client, stream };
}

async function* runDoubaoChat(
  req: ZeroApiChatRequest,
): AsyncGenerator<{ text?: string; reasoning?: string }, void, void> {
  let creds = await resolveCredentials();
  let opened: { client: DoubaoWebClient; stream: ReadableStream<Uint8Array> };
  try {
    opened = await openUpstream(creds, req.prompt, req.model);
  } catch (err: unknown) {
    if (!isAuthError(err)) throw err;
    console.warn("[zero-api doubao-web] auth failed; re-running login flow and retrying once...");
    creds = await ensureDoubaoWebLogin();
    opened = await openUpstream(creds, req.prompt, req.model);
  }
  try {
    for await (const delta of iterateDoubaoStream(opened.stream)) {
      yield delta;
    }
  } finally {
    await opened.client.close().catch(() => undefined);
  }
}

export function registerDoubaoWebHandler(): void {
  registerShimHandler({
    id: "doubao-web",
    label: "Doubao Web",
    modelIds: DOUBAO_WEB_MODEL_CATALOG.map((m) => m.id),
    async handleChat(req: ZeroApiChatRequest): Promise<ZeroApiStreamResult> {
      return runDoubaoChat(req);
    },
  });
}
