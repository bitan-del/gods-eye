import {
  registerShimHandler,
  type ZeroApiChatRequest,
  type ZeroApiStreamResult,
} from "../../shim/handler-registry.js";
import {
  formatCookieHeader,
  loadDeepSeekWebCredentials,
  type DeepSeekWebCredentials,
} from "./deepseek-auth.js";
import { DeepSeekWebClient, type DeepSeekWebClientOptions } from "./deepseek-client.js";
import { ensureDeepSeekWebLogin } from "./deepseek-login.js";
import { iterateDeepSeekStream } from "./deepseek-stream.js";
import { DEEPSEEK_WEB_MODEL_CATALOG } from "./models.js";

function isAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /\b(401|403)\b/.test(msg) || /unauthori[sz]ed/i.test(msg);
}

async function resolveCredentials(): Promise<DeepSeekWebCredentials> {
  const existing = await loadDeepSeekWebCredentials();
  if (existing) return existing;
  console.info(
    "[zero-api deepseek] DeepSeek Web credentials missing; launching browser login flow...",
  );
  return ensureDeepSeekWebLogin();
}

function buildClient(c: DeepSeekWebCredentials): DeepSeekWebClient {
  const opts: DeepSeekWebClientOptions = {
    cookie: formatCookieHeader(c.cookies),
    ...(c.userToken ? { bearer: c.userToken } : {}),
    ...(c.userAgent ? { userAgent: c.userAgent } : {}),
  };
  return new DeepSeekWebClient(opts);
}

async function openUpstream(
  c: DeepSeekWebCredentials,
  prompt: string,
  model: string,
): Promise<ReadableStream<Uint8Array>> {
  const client = buildClient(c);
  await client.init();
  const session = await client.createChatSession();
  const upstream = await client.chatCompletions({
    sessionId: session.chat_session_id,
    parentMessageId: null,
    message: prompt,
    model,
    searchEnabled: false,
  });
  if (!upstream) {
    throw new Error("DeepSeek Web returned empty response body");
  }
  return upstream;
}

async function* runDeepSeekChat(
  req: ZeroApiChatRequest,
): AsyncGenerator<{ text?: string; reasoning?: string }, void, void> {
  let creds = await resolveCredentials();
  let upstream: ReadableStream<Uint8Array>;
  try {
    upstream = await openUpstream(creds, req.prompt, req.model);
  } catch (err: unknown) {
    if (!isAuthError(err)) throw err;
    console.warn("[zero-api deepseek] auth failed; re-running login flow and retrying once...");
    creds = await ensureDeepSeekWebLogin();
    upstream = await openUpstream(creds, req.prompt, req.model);
  }
  for await (const delta of iterateDeepSeekStream(upstream)) {
    yield delta;
  }
}

export function registerDeepSeekWebHandler(): void {
  registerShimHandler({
    id: "deepseek-web",
    label: "DeepSeek Web",
    modelIds: DEEPSEEK_WEB_MODEL_CATALOG.map((m) => m.id),
    async handleChat(req: ZeroApiChatRequest): Promise<ZeroApiStreamResult> {
      return runDeepSeekChat(req);
    },
  });
}
