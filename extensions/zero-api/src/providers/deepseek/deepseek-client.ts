import crypto from "node:crypto";
import { SHA3_WASM_B64 } from "./sha3-wasm.js";

/**
 * DeepSeek Web client — ported from upstream reference implementation.
 *
 * Handles:
 *   - fetching the chat.deepseek.com session/device headers
 *   - requesting and solving the Proof-of-Work challenge (SHA256 + DeepSeekHashV1 WASM)
 *   - creating a DeepSeek chat session and posting user turns
 *   - returning the raw SSE ReadableStream for the chat completion
 *
 * It intentionally does NOT know anything about OpenAI chunk formats; the
 * shim layer translates DeepSeek SSE events into OpenAI-compat chunks.
 */

export interface DeepSeekPowChallenge {
  algorithm: string;
  challenge: string;
  difficulty: number;
  salt: string;
  signature: string;
  expire_at?: number; // Added for DeepSeekHashV1
}

export interface DeepSeekChatSession {
  biz_id: string;
  chat_session_id: string;
  title: string;
  id?: string;
}

export interface DeepSeekWebClientOptions {
  cookie: string;
  bearer?: string;
  userAgent?: string;
}

interface DeepSeekWasmExports extends WebAssembly.Exports {
  memory: WebAssembly.Memory;
  __wbindgen_export_0: (a: number, b: number) => number;
  __wbindgen_add_to_stack_pointer: (a: number) => number;
  wasm_solve: (
    retptr: number,
    ptrC: number,
    lenC: number,
    ptrP: number,
    lenP: number,
    difficulty: number,
  ) => void;
}

interface DeepSeekPowResponse {
  data?: {
    biz_data?: {
      challenge?: DeepSeekPowChallenge;
    };
    challenge?: DeepSeekPowChallenge;
  };
  challenge?: DeepSeekPowChallenge;
}

interface DeepSeekChatSessionResponse {
  data?: {
    biz_data?: DeepSeekChatSession;
  };
}

export class DeepSeekWebClient {
  private cookie: string;
  private bearer: string;
  private userAgent: string;
  private deviceId: string = "";
  private wasmModule: WebAssembly.Instance | null = null;

  constructor(options: DeepSeekWebClientOptions | string) {
    let finalOptions: DeepSeekWebClientOptions;
    if (typeof options === "string") {
      try {
        const parsed = JSON.parse(options) as DeepSeekWebClientOptions | string;
        finalOptions = typeof parsed === "string" ? { cookie: parsed } : parsed;
      } catch {
        finalOptions = { cookie: options };
      }
    } else {
      finalOptions = options;
    }

    this.cookie = finalOptions.cookie || "";
    this.bearer = finalOptions.bearer || "";
    this.userAgent =
      finalOptions.userAgent ||
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  }

  private fetchHeaders(): Record<string, string> {
    return {
      Cookie: this.cookie,
      "User-Agent": this.userAgent,
      "Content-Type": "application/json",
      Accept: "*/*",
      ...(this.bearer ? { Authorization: `Bearer ${this.bearer}` } : {}),
      Referer: "https://chat.deepseek.com/",
      Origin: "https://chat.deepseek.com",
      "x-client-platform": "web",
      "x-client-version": "1.7.0",
      "x-app-version": "20241129.1",
      "x-client-locale": "zh_CN",
      "x-client-timezone-offset": "28800",
    };
  }

  async init(): Promise<void> {
    if (!this.deviceId) {
      try {
        await fetch("https://chat.deepseek.com/api/v0/client/settings?did=&scope=banner", {
          headers: this.fetchHeaders(),
        });
      } catch (error) {
        console.warn("[DeepSeekWebClient] Failed to fetch settings:", error);
      }
    }
  }

  async createPowChallenge(targetPath: string): Promise<DeepSeekPowChallenge> {
    const res = await fetch("https://chat.deepseek.com/api/v0/chat/create_pow_challenge", {
      method: "POST",
      headers: this.fetchHeaders(),
      body: JSON.stringify({ target_path: targetPath }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to create PoW challenge: ${res.status} ${errorText}`);
    }

    const data = (await res.json()) as DeepSeekPowResponse;
    const challenge = data.data?.biz_data?.challenge || data.data?.challenge || data.challenge;
    if (!challenge) {
      throw new Error(`PoW challenge missing in response`);
    }
    return challenge;
  }

  private async getWasmInstance(): Promise<WebAssembly.Instance> {
    if (this.wasmModule) {
      return this.wasmModule;
    }
    const wasmBuffer = Buffer.from(SHA3_WASM_B64, "base64");
    const { instance } = await WebAssembly.instantiate(wasmBuffer, { wbg: {} });
    this.wasmModule = instance;
    return instance;
  }

  async solvePow(challenge: DeepSeekPowChallenge): Promise<number> {
    const { algorithm, challenge: target, salt, difficulty, expire_at } = challenge;

    if (algorithm === "sha256") {
      let nonce = 0;
      while (true) {
        const input = salt + target + nonce;
        const hash = crypto.createHash("sha256").update(input).digest("hex");
        let zeroBits = 0;
        for (const char of hash) {
          const val = parseInt(char, 16);
          if (val === 0) {
            zeroBits += 4;
          } else {
            zeroBits += Math.clz32(val) - 28;
            break;
          }
        }
        const targetDifficulty = difficulty > 1000 ? Math.floor(Math.log2(difficulty)) : difficulty;
        if (zeroBits >= targetDifficulty) {
          return nonce;
        }
        nonce++;
        if (nonce > 1_000_000) {
          throw new Error("SHA256 PoW timeout");
        }
      }
    }

    if (algorithm === "DeepSeekHashV1") {
      const instance = await this.getWasmInstance();
      const exports = instance.exports as unknown as DeepSeekWasmExports;
      const memory = exports.memory;
      const alloc = exports.__wbindgen_export_0;
      const addToStack = exports.__wbindgen_add_to_stack_pointer;
      const wasmSolve = exports.wasm_solve;

      const prefix = `${salt}_${expire_at}_`;
      const encodeString = (str: string): [number, number] => {
        const buf = Buffer.from(str, "utf8");
        const ptr = alloc(buf.length, 1);
        new Uint8Array(memory.buffer).set(buf, ptr);
        return [ptr, buf.length];
      };

      const [ptrC, lenC] = encodeString(target);
      const [ptrP, lenP] = encodeString(prefix);
      const retptr = addToStack(-16);
      wasmSolve(retptr, ptrC, lenC, ptrP, lenP, difficulty);
      const view = new DataView(memory.buffer);
      const status = view.getInt32(retptr, true);
      const answer = view.getFloat64(retptr + 8, true);
      addToStack(16);

      if (status === 0) {
        throw new Error("DeepSeekHashV1 failed to find solution");
      }
      return answer;
    }

    throw new Error(`Unsupported PoW algorithm: ${algorithm}`);
  }

  async createChatSession(): Promise<DeepSeekChatSession> {
    const targetPath = "/api/v0/chat_session/create";
    const res = await fetch(`https://chat.deepseek.com${targetPath}`, {
      method: "POST",
      headers: this.fetchHeaders(),
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to create chat session: ${res.status} ${errorText}`);
    }

    const data = (await res.json()) as DeepSeekChatSessionResponse;
    const sessionId = data.data?.biz_data?.id || data.data?.biz_data?.chat_session_id || "";
    return {
      biz_id: data.data?.biz_data?.biz_id || "",
      title: data.data?.biz_data?.title || "",
      ...data.data?.biz_data,
      chat_session_id: sessionId,
    };
  }

  async chatCompletions(params: {
    sessionId: string;
    message: string;
    model?: string;
    fileIds?: string[];
    searchEnabled?: boolean;
    preempt?: boolean;
    parentMessageId?: string | number | null;
    signal?: AbortSignal;
  }): Promise<ReadableStream<Uint8Array> | null> {
    const targetPath = "/api/v0/chat/completion";
    const challenge = await this.createPowChallenge(targetPath);
    const answer = await this.solvePow(challenge);
    const powResponse = Buffer.from(
      JSON.stringify({
        ...challenge,
        answer,
        target_path: targetPath,
      }),
    ).toString("base64");

    // DeepSeek's "thinking" toggle: enable for everything except plain chat
    // with no reasoning hint in its id.
    const thinkingEnabled = !(
      params.model === "deepseek-chat" && !params.model?.includes("reasoning")
    );

    const res = await fetch(`https://chat.deepseek.com${targetPath}`, {
      method: "POST",
      headers: {
        ...this.fetchHeaders(),
        "x-ds-pow-response": powResponse,
      },
      body: JSON.stringify({
        chat_session_id: params.sessionId,
        parent_message_id: params.parentMessageId ?? null,
        prompt: params.message,
        ref_file_ids: params.fileIds || [],
        thinking_enabled: thinkingEnabled,
        search_enabled: params.searchEnabled ?? false,
        preempt: params.preempt ?? false,
      }),
      signal: params.signal,
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Chat completion failed: ${res.status} ${errorText}`);
    }

    return res.body;
  }
}
