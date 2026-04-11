import {
  registerShimHandler,
  type ZeroApiChatRequest,
  type ZeroApiStreamResult,
} from "../../shim/handler-registry.js";
import {
  formatKimiCookieHeader,
  loadKimiWebCredentials,
  type KimiWebCredentials,
} from "./kimi-auth.js";
import { KimiWebClient } from "./kimi-client.js";
import { ensureKimiWebLogin } from "./kimi-login.js";
import { iterateKimiStream } from "./kimi-stream.js";
import { KIMI_WEB_MODEL_CATALOG } from "./models.js";

function isAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /\b(401|403)\b/.test(msg) || /unauthori[sz]ed/i.test(msg);
}

async function resolveCredentials(): Promise<KimiWebCredentials> {
  const existing = await loadKimiWebCredentials();
  if (existing) return existing;
  console.info("[zero-api kimi] Kimi Web credentials missing; launching browser login flow...");
  return ensureKimiWebLogin();
}

// Cache the persistent-page client between chat turns.
let cachedClient: KimiWebClient | null = null;
let cachedKey: string | null = null;

function buildClient(c: KimiWebCredentials): KimiWebClient {
  const accessToken = c.accessToken ?? c.cookies["kimi-auth"] ?? "";
  const cookie = formatKimiCookieHeader(c.cookies);
  const key = `${accessToken}|${cookie}`;
  if (cachedClient && cachedKey === key) {
    return cachedClient;
  }
  if (cachedClient) {
    cachedClient.close().catch(() => undefined);
  }
  cachedClient = new KimiWebClient({
    cookie,
    accessToken,
    ...(c.userAgent ? { userAgent: c.userAgent } : {}),
  });
  cachedKey = key;
  return cachedClient;
}

async function openUpstream(
  c: KimiWebCredentials,
  prompt: string,
  model: string,
): Promise<ReadableStream<Uint8Array>> {
  const client = buildClient(c);
  await client.init();
  return client.chatCompletions({ message: prompt, model });
}

async function* runKimiChat(
  req: ZeroApiChatRequest,
): AsyncGenerator<{ text?: string; reasoning?: string }, void, void> {
  let creds = await resolveCredentials();
  let upstream: ReadableStream<Uint8Array>;
  try {
    upstream = await openUpstream(creds, req.prompt, req.model);
  } catch (err: unknown) {
    if (!isAuthError(err)) throw err;
    console.warn("[zero-api kimi] auth failed; re-running login flow and retrying once...");
    if (cachedClient) {
      cachedClient.close().catch(() => undefined);
      cachedClient = null;
      cachedKey = null;
    }
    creds = await ensureKimiWebLogin();
    upstream = await openUpstream(creds, req.prompt, req.model);
  }
  for await (const delta of iterateKimiStream(upstream)) {
    yield delta;
  }
}

export function registerKimiWebHandler(): void {
  registerShimHandler({
    id: "kimi-web",
    label: "Kimi Web",
    modelIds: KIMI_WEB_MODEL_CATALOG.map((m) => m.id),
    async handleChat(req: ZeroApiChatRequest): Promise<ZeroApiStreamResult> {
      return runKimiChat(req);
    },
  });
}
