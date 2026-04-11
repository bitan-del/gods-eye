import {
  registerShimHandler,
  type ZeroApiChatRequest,
  type ZeroApiStreamResult,
} from "../../shim/handler-registry.js";
import {
  formatCookieHeader,
  loadGlmCnWebCredentials,
  type GlmCnWebCredentials,
} from "./glm-cn-auth.js";
import { GlmCnWebClient, type GlmCnWebClientOptions } from "./glm-cn-client.js";
import { ensureGlmCnWebLogin } from "./glm-cn-login.js";
import { iterateGlmCnStream } from "./glm-cn-stream.js";
import { GLM_CN_WEB_MODEL_CATALOG } from "./models.js";

function isAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /\b(401|403)\b/.test(msg) || /unauthori[sz]ed/i.test(msg);
}

async function resolveCredentials(): Promise<GlmCnWebCredentials> {
  const existing = await loadGlmCnWebCredentials();
  if (existing) return existing;
  console.info(
    "[zero-api glm-cn-web] ChatGLM CN credentials missing; launching browser login flow...",
  );
  return ensureGlmCnWebLogin();
}

function buildClient(c: GlmCnWebCredentials): GlmCnWebClient {
  const opts: GlmCnWebClientOptions = {
    cookie: formatCookieHeader(c.cookies),
    ...(c.userToken ? { bearer: c.userToken } : {}),
    ...(c.userAgent ? { userAgent: c.userAgent } : {}),
  };
  return new GlmCnWebClient(opts);
}

async function openUpstream(
  c: GlmCnWebCredentials,
  prompt: string,
  model: string,
): Promise<{ client: GlmCnWebClient; stream: ReadableStream<Uint8Array> }> {
  const client = buildClient(c);
  await client.init();
  const stream = await client.chatCompletions({ message: prompt, model });
  return { client, stream };
}

async function* runGlmCnChat(
  req: ZeroApiChatRequest,
): AsyncGenerator<{ text?: string; reasoning?: string }, void, void> {
  let creds = await resolveCredentials();
  let opened: { client: GlmCnWebClient; stream: ReadableStream<Uint8Array> };
  try {
    opened = await openUpstream(creds, req.prompt, req.model);
  } catch (err: unknown) {
    if (!isAuthError(err)) throw err;
    console.warn("[zero-api glm-cn-web] auth failed; re-running login flow and retrying once...");
    creds = await ensureGlmCnWebLogin();
    opened = await openUpstream(creds, req.prompt, req.model);
  }
  try {
    for await (const delta of iterateGlmCnStream(opened.stream)) {
      yield delta;
    }
  } finally {
    await opened.client.close().catch(() => undefined);
  }
}

export function registerGlmCnWebHandler(): void {
  registerShimHandler({
    id: "glm-cn-web",
    label: "ChatGLM CN Web",
    modelIds: GLM_CN_WEB_MODEL_CATALOG.map((m) => m.id),
    async handleChat(req: ZeroApiChatRequest): Promise<ZeroApiStreamResult> {
      return runGlmCnChat(req);
    },
  });
}
