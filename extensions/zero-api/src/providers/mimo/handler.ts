import {
  registerShimHandler,
  type ZeroApiChatRequest,
  type ZeroApiStreamResult,
} from "../../shim/handler-registry.js";
import {
  formatCookieHeader,
  loadMimoWebCredentials,
  type MimoWebCredentials,
} from "./mimo-auth.js";
import { MimoWebClient, type MimoWebClientOptions } from "./mimo-client.js";
import { ensureMimoWebLogin } from "./mimo-login.js";
import { iterateMimoStream } from "./mimo-stream.js";
import { MIMO_WEB_MODEL_CATALOG } from "./models.js";

function isAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /\b(401|403)\b/.test(msg) || /unauthori[sz]ed/i.test(msg);
}

async function resolveCredentials(): Promise<MimoWebCredentials> {
  const existing = await loadMimoWebCredentials();
  if (existing) return existing;
  console.info("[zero-api mimo] MiMo Web credentials missing; launching browser login flow...");
  return ensureMimoWebLogin();
}

function buildClient(c: MimoWebCredentials): MimoWebClient {
  const opts: MimoWebClientOptions = {
    cookie: formatCookieHeader(c.cookies),
    ...(c.userToken ? { bearer: c.userToken } : {}),
    ...(c.userAgent ? { userAgent: c.userAgent } : {}),
  };
  return new MimoWebClient(opts);
}

async function openUpstream(
  c: MimoWebCredentials,
  prompt: string,
  model: string,
): Promise<ReadableStream<Uint8Array>> {
  const client = buildClient(c);
  await client.init();
  return client.chatCompletions({
    message: prompt,
    model,
  });
}

async function* runMimoChat(
  req: ZeroApiChatRequest,
): AsyncGenerator<{ text?: string; reasoning?: string }, void, void> {
  let creds = await resolveCredentials();
  let upstream: ReadableStream<Uint8Array>;
  try {
    upstream = await openUpstream(creds, req.prompt, req.model);
  } catch (err: unknown) {
    if (!isAuthError(err)) throw err;
    console.warn("[zero-api mimo] auth failed; re-running login flow and retrying once...");
    creds = await ensureMimoWebLogin();
    upstream = await openUpstream(creds, req.prompt, req.model);
  }
  for await (const delta of iterateMimoStream(upstream)) {
    yield delta;
  }
}

export function registerMimoWebHandler(): void {
  registerShimHandler({
    id: "mimo-web",
    label: "Xiaomi MiMo Web",
    modelIds: MIMO_WEB_MODEL_CATALOG.map((m) => m.id),
    async handleChat(req: ZeroApiChatRequest): Promise<ZeroApiStreamResult> {
      return runMimoChat(req);
    },
  });
}
