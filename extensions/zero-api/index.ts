import { definePluginEntry } from "godseye/plugin-sdk/plugin-entry";
import { registerDeepSeekWeb } from "./src/providers/deepseek/register.js";
import { registerDoubaoWeb } from "./src/providers/doubao/register.js";
import { registerGlmCnWeb } from "./src/providers/glm-cn/register.js";
import { registerKimiWeb } from "./src/providers/kimi/register.js";
import { registerMimoWeb } from "./src/providers/mimo/register.js";
import { registerQwenCnWeb } from "./src/providers/qwen-cn/register.js";
import { registerQwenWeb } from "./src/providers/qwen/register.js";

/**
 * Gods Eye "Zero API" plugin.
 *
 * Registers browser-session providers that route through a local
 * OpenAI-compatible HTTP shim on 127.0.0.1:64201. The core gateway only sees
 * `openai-completions` providers; the shim translates to each vendor's
 * internal web API using cookies captured from a logged-in browser session
 * and stored under `~/.godseye/credentials/zero-api/`.
 *
 * Each provider's own `register.ts` registers both the gateway provider
 * catalog entry (via `api.registerProvider`) and the shim handler (via
 * `registerShimHandler`). The provider list here intentionally omits Claude
 * Web because Gods Eye ships its own first-party Claude flow.
 */
export default definePluginEntry({
  id: "zero-api",
  name: "Zero API Providers",
  description: "Browser-session (zero-api) provider plugin",
  register(api) {
    registerDeepSeekWeb(api);
    registerQwenWeb(api);
    registerQwenCnWeb(api);
    registerKimiWeb(api);
    registerGlmCnWeb(api);
    registerDoubaoWeb(api);
    registerMimoWeb(api);
  },
});
