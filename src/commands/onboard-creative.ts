// Onboard Creative — setup step for Gods Eye Studio creative API keys.
// Prompts the user for fal.ai, Gemini, and other creative provider keys
// during `godseye onboard`. Runs after search setup, before skills.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { GodsEyeConfig } from "../config/config.js";
import { enablePluginInConfig } from "../plugins/enable.js";
import type { RuntimeEnv } from "../runtime.js";
import type { WizardPrompter } from "../wizard/prompts.js";
// SecretInputMode reserved for future use when we support masked input.

interface CreativeProvider {
  id: string;
  label: string;
  envVars: string[];
  hint: string;
  pluginId: string;
}

const CREATIVE_PROVIDERS: readonly CreativeProvider[] = [
  {
    id: "fal",
    label: "fal.ai",
    envVars: ["FAL_KEY"],
    hint: "Image and video generation (Flux, Minimax, etc.)",
    pluginId: "fal",
  },
  {
    id: "gemini-creative",
    label: "Google Gemini",
    envVars: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    hint: "Creative intelligence, brand analysis, and image understanding",
    pluginId: "google",
  },
  {
    id: "openai-image",
    label: "OpenAI (DALL-E / GPT Image)",
    envVars: ["OPENAI_API_KEY"],
    hint: "DALL-E and GPT image generation",
    pluginId: "openai",
  },
];

function resolveExistingKeyVar(
  envVars: readonly string[],
  env: NodeJS.ProcessEnv,
): string | undefined {
  return envVars.find((v) => Boolean(env[v]?.trim()));
}

// Persist an API key into the auth-profiles store so it survives process restarts.
function persistApiKeyToAuthStore(providerId: string, apiKey: string): void {
  const authDir = join(homedir(), ".godseye", "agents", "main", "agent");
  const authPath = join(authDir, "auth-profiles.json");
  try {
    mkdirSync(authDir, { recursive: true });
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(readFileSync(authPath, "utf-8")) as Record<string, unknown>;
    } catch {
      data = { version: 1, profiles: {}, lastGood: {}, usageStats: {} };
    }
    const profiles = (data.profiles ?? {}) as Record<string, unknown>;
    const lastGood = (data.lastGood ?? {}) as Record<string, string>;
    const profileKey = `${providerId}:default`;
    profiles[profileKey] = {
      type: "api_key",
      provider: providerId,
      key: apiKey,
    };
    lastGood[providerId] = profileKey;
    data.profiles = profiles;
    data.lastGood = lastGood;
    writeFileSync(authPath, JSON.stringify(data, null, 2));
  } catch {
    // Non-fatal — the key is still in process.env for this session.
  }
}

export async function setupCreativeTools(
  config: GodsEyeConfig,
  runtime: RuntimeEnv,
  prompter: WizardPrompter,
  _options?: {
    quickstartDefaults?: boolean;
  },
): Promise<GodsEyeConfig> {
  let nextConfig = { ...config };
  const env = process.env;

  // Ask if user wants to set up creative tools
  const wantsCreative = await prompter.confirm({
    message: "Set up Gods Eye Studio? (image gen, video gen, brand intelligence)",
    initialValue: true,
  });

  if (!wantsCreative) {
    await prompter.note(
      "Skipping creative tools setup. You can set them up later via godseye configure.",
      "Studio",
    );
    return nextConfig;
  }

  await prompter.note(
    [
      "Gods Eye Studio provides a unified creative brain for:",
      "- Image generation (fal.ai Flux, DALL-E, Imagen)",
      "- Video generation (fal.ai Minimax, Runway)",
      "- Brand intelligence (scan websites to extract brand DNA)",
      "- Content calendar (plan, generate, approve, publish)",
      "- Creative memory (the brain remembers every generation)",
      "",
      "You can add API keys now or skip and add them later.",
      "Each provider is optional — use the ones you want.",
    ].join("\n"),
    "Gods Eye Studio",
  );

  // Enable the studio plugin
  nextConfig = enablePluginInConfig(nextConfig, "gods-eye-studio").config;

  for (const provider of CREATIVE_PROVIDERS) {
    const existingVar = resolveExistingKeyVar(provider.envVars, env);

    if (existingVar) {
      const useExisting = await prompter.confirm({
        message: `Found ${existingVar} in environment. Use it for ${provider.label}?`,
        initialValue: true,
      });
      if (useExisting) {
        // Also persist the env key to auth store so it survives beyond this process
        const envValue = env[existingVar]?.trim();
        if (envValue) {
          persistApiKeyToAuthStore(
            provider.id === "gemini-creative" ? "google" : provider.id,
            envValue,
          );
        }
        await prompter.note(
          `Using existing ${existingVar} for ${provider.label}. Saved.`,
          "Studio",
        );
        nextConfig = enablePluginInConfig(nextConfig, provider.pluginId).config;
        continue;
      }
    }

    const wantsProvider = await prompter.confirm({
      message: `Configure ${provider.label}? (${provider.hint})`,
      initialValue: false,
    });

    if (!wantsProvider) {
      continue;
    }

    const apiKey = await prompter.text({
      message: `Enter ${provider.label} API key`,
      placeholder: provider.envVars[0],
    });

    if (apiKey?.trim()) {
      const trimmedKey = apiKey.trim();
      // Set in current process so subsequent steps can see it
      const envVar = provider.envVars[0];
      if (envVar) {
        env[envVar] = trimmedKey;
      }
      // Persist to auth-profiles.json so the key survives restarts
      persistApiKeyToAuthStore(
        provider.id === "gemini-creative" ? "google" : provider.id,
        trimmedKey,
      );
      nextConfig = enablePluginInConfig(nextConfig, provider.pluginId).config;
      await prompter.note(`${provider.label} configured and saved.`, "Studio");
    }
  }

  // Enable the studio extension itself
  nextConfig = enablePluginInConfig(nextConfig, "gods-eye-studio").config;

  await prompter.note(
    [
      "Studio setup complete. Your creative tools are ready.",
      "",
      "Try these after onboarding:",
      '  godseye agent --message "generate a hero image for my landing page"',
      '  godseye agent --message "scan my brand from https://example.com"',
      '  godseye agent --message "show my content calendar for this week"',
    ].join("\n"),
    "Gods Eye Studio",
  );

  return nextConfig;
}
