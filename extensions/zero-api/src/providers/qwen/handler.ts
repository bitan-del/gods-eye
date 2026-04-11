import {
  registerShimHandler,
  type ZeroApiChatRequest,
  type ZeroApiStreamResult,
} from "../../shim/handler-registry.js";
import { QWEN_WEB_MODEL_CATALOG } from "./models.js";
import {
  formatQwenCookieHeader,
  loadQwenWebCredentials,
  type QwenWebCredentials,
} from "./qwen-auth.js";
import { QwenWebClient } from "./qwen-client.js";
import { ensureQwenWebLogin } from "./qwen-login.js";
import { iterateQwenStream } from "./qwen-stream.js";

function isAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /\b(401|403)\b/.test(msg) || /unauthori[sz]ed/i.test(msg);
}

async function resolveCredentials(): Promise<QwenWebCredentials> {
  const existing = await loadQwenWebCredentials();
  if (existing) return existing;
  console.info("[zero-api qwen] Qwen Web credentials missing; launching browser login flow...");
  return ensureQwenWebLogin();
}

function buildClient(c: QwenWebCredentials): QwenWebClient {
  return new QwenWebClient({
    cookie: formatQwenCookieHeader(c.cookies),
    bearer: c.bearer ?? "",
    ...(c.userAgent ? { userAgent: c.userAgent } : {}),
  });
}

async function openUpstream(
  c: QwenWebCredentials,
  prompt: string,
  model: string,
): Promise<ReadableStream<Uint8Array>> {
  const client = buildClient(c);
  await client.init();
  const chatId = await client.createChat();
  return client.chatCompletions({
    chatId,
    message: prompt,
    model,
  });
}

async function* runQwenChat(
  req: ZeroApiChatRequest,
): AsyncGenerator<{ text?: string; reasoning?: string }, void, void> {
  let creds = await resolveCredentials();
  let upstream: ReadableStream<Uint8Array>;
  try {
    upstream = await openUpstream(creds, req.prompt, req.model);
  } catch (err: unknown) {
    if (!isAuthError(err)) throw err;
    console.warn("[zero-api qwen] auth failed; re-running login flow and retrying once...");
    creds = await ensureQwenWebLogin();
    upstream = await openUpstream(creds, req.prompt, req.model);
  }
  for await (const delta of iterateQwenStream(upstream)) {
    yield delta;
  }
}

export function registerQwenWebHandler(): void {
  registerShimHandler({
    id: "qwen-web",
    label: "Qwen Web",
    modelIds: QWEN_WEB_MODEL_CATALOG.map((m) => m.id),
    async handleChat(req: ZeroApiChatRequest): Promise<ZeroApiStreamResult> {
      return runQwenChat(req);
    },
  });
}
