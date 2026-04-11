import {
  registerShimHandler,
  type ZeroApiChatRequest,
  type ZeroApiStreamResult,
} from "../../shim/handler-registry.js";
import { QWEN_CN_WEB_MODEL_CATALOG } from "./models.js";
import {
  formatQwenCnCookieHeader,
  loadQwenCnWebCredentials,
  type QwenCnWebCredentials,
} from "./qwen-cn-auth.js";
import { QwenCnWebClient } from "./qwen-cn-client.js";
import { ensureQwenCnWebLogin } from "./qwen-cn-login.js";
import { iterateQwenCnStream } from "./qwen-cn-stream.js";

function isAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /\b(401|403)\b/.test(msg) || /unauthori[sz]ed/i.test(msg);
}

async function resolveCredentials(): Promise<QwenCnWebCredentials> {
  const existing = await loadQwenCnWebCredentials();
  if (existing) return existing;
  console.info(
    "[zero-api qwen-cn] Qwen CN Web credentials missing; launching browser login flow...",
  );
  return ensureQwenCnWebLogin();
}

// Cache the client between chat turns so we don't spawn a fresh Chrome for
// every message. The shim server lifetime is the plugin lifetime.
let cachedClient: QwenCnWebClient | null = null;
let cachedClientBearer: string | null = null;

function buildClient(c: QwenCnWebCredentials): QwenCnWebClient {
  const key = `${c.xsrfToken}|${c.ut}|${formatQwenCnCookieHeader(c.cookies)}`;
  if (cachedClient && cachedClientBearer === key) {
    return cachedClient;
  }
  if (cachedClient) {
    cachedClient.close().catch(() => undefined);
  }
  cachedClient = new QwenCnWebClient({
    cookie: formatQwenCnCookieHeader(c.cookies),
    xsrfToken: c.xsrfToken,
    ut: c.ut,
    ...(c.userAgent ? { userAgent: c.userAgent } : {}),
  });
  cachedClientBearer = key;
  return cachedClient;
}

async function openUpstream(
  c: QwenCnWebCredentials,
  prompt: string,
  model: string,
): Promise<ReadableStream<Uint8Array>> {
  const client = buildClient(c);
  await client.init();
  return client.chatCompletions({ message: prompt, model });
}

async function* runQwenCnChat(
  req: ZeroApiChatRequest,
): AsyncGenerator<{ text?: string; reasoning?: string }, void, void> {
  let creds = await resolveCredentials();
  let upstream: ReadableStream<Uint8Array>;
  try {
    upstream = await openUpstream(creds, req.prompt, req.model);
  } catch (err: unknown) {
    if (!isAuthError(err)) throw err;
    console.warn("[zero-api qwen-cn] auth failed; re-running login flow and retrying once...");
    // Force a fresh browser state after login.
    if (cachedClient) {
      cachedClient.close().catch(() => undefined);
      cachedClient = null;
      cachedClientBearer = null;
    }
    creds = await ensureQwenCnWebLogin();
    upstream = await openUpstream(creds, req.prompt, req.model);
  }
  for await (const delta of iterateQwenCnStream(upstream)) {
    yield delta;
  }
}

export function registerQwenCnWebHandler(): void {
  registerShimHandler({
    id: "qwen-cn-web",
    label: "Qwen CN Web",
    modelIds: QWEN_CN_WEB_MODEL_CATALOG.map((m) => m.id),
    async handleChat(req: ZeroApiChatRequest): Promise<ZeroApiStreamResult> {
      return runQwenCnChat(req);
    },
  });
}
