import crypto from "node:crypto";

/**
 * Qwen Web client (chat.qwen.ai, international).
 *
 * Runtime path: plain Node `fetch()` with captured cookies + Bearer token.
 *
 * The upstream reference implementation drives a Playwright page at runtime
 * to avoid bot-detection and reuse browser credential state. We deliberately
 * prefer a plain `fetch()` call: chat.qwen.ai's `/api/v2/*` endpoints accept
 * a direct Bearer Authorization header (the same header the SPA sends) as
 * long as you include the session cookies captured at login. Running the
 * request from Node is much simpler and avoids keeping a second Chrome alive
 * between chat turns. If Qwen adds stricter bot fingerprinting in the future
 * we can fall back to a persistent Playwright page like the upstream client.
 */

export interface QwenWebClientOptions {
  cookie: string;
  bearer: string;
  userAgent?: string;
}

interface QwenNewChatResponse {
  data?: { id?: string; chat_id?: string };
  chat_id?: string;
  id?: string;
  chatId?: string;
}

export class QwenWebClient {
  private cookie: string;
  private bearer: string;
  private userAgent: string;
  private baseUrl = "https://chat.qwen.ai";

  constructor(options: QwenWebClientOptions) {
    this.cookie = options.cookie;
    this.bearer = options.bearer;
    this.userAgent =
      options.userAgent ||
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      "User-Agent": this.userAgent,
      Cookie: this.cookie,
      Authorization: `Bearer ${this.bearer}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream, application/json, */*",
      Origin: this.baseUrl,
      Referer: `${this.baseUrl}/`,
      "x-platform": "web",
      ...(extra || {}),
    };
  }

  async init(): Promise<void> {
    // No-op; kept for symmetry with the deepseek client.
  }

  async createChat(): Promise<string> {
    const url = `${this.baseUrl}/api/v2/chats/new`;
    const res = await fetch(url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Failed to create Qwen chat: ${res.status} ${text.slice(0, 300)}`);
    }
    const data = (await res.json()) as QwenNewChatResponse;
    const chatId = data.data?.id || data.data?.chat_id || data.chat_id || data.id || data.chatId;
    if (!chatId) {
      throw new Error("Qwen created chat but response was missing chat id.");
    }
    return chatId;
  }

  async chatCompletions(params: {
    chatId: string;
    message: string;
    model: string;
    signal?: AbortSignal;
  }): Promise<ReadableStream<Uint8Array>> {
    const url = `${this.baseUrl}/api/v2/chat/completions?chat_id=${params.chatId}`;
    const fid = crypto.randomUUID();
    const body = {
      stream: true,
      version: "2.1",
      incremental_output: true,
      chat_id: params.chatId,
      chat_mode: "normal",
      model: params.model,
      parent_id: null,
      messages: [
        {
          fid,
          parentId: null,
          childrenIds: [],
          role: "user",
          content: params.message,
          user_action: "chat",
          files: [],
          timestamp: Math.floor(Date.now() / 1000),
          models: [params.model],
          chat_type: "t2t",
          feature_config: { thinking_enabled: true, output_schema: "phase" },
        },
      ],
    };
    const res = await fetch(url, {
      method: "POST",
      headers: this.headers({ Accept: "text/event-stream" }),
      body: JSON.stringify(body),
      signal: params.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Qwen chat completions failed: ${res.status} ${text.slice(0, 300)}`);
    }
    if (!res.body) {
      throw new Error("Qwen chat completions returned empty body.");
    }
    return res.body;
  }
}
