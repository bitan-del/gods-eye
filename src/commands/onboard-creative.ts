// Onboard Creative — setup step for Gods Eye Studio creative API keys.
// Prompts the user for fal.ai, Gemini, and other creative provider keys
// during `godseye onboard`. Runs after search setup, before skills.

import type { GodsEyeConfig } from "../config/config.js";
import { enablePluginInConfig } from "../plugins/enable.js";
import type { RuntimeEnv } from "../runtime.js";
import type { WizardPrompter } from "../wizard/prompts.js";
import type { SecretInputMode } from "./onboard-types.js";

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

export async function setupCreativeTools(
  config: GodsEyeConfig,
  runtime: RuntimeEnv,
  prompter: WizardPrompter,
  _options?: {
    quickstartDefaults?: boolean;
    secretInputMode?: SecretInputMode;
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
  nextConfig = enablePluginInConfig(nextConfig, "gods-eye-studio");

  for (const provider of CREATIVE_PROVIDERS) {
    const existingVar = resolveExistingKeyVar(provider.envVars, env);

    if (existingVar) {
      const useExisting = await prompter.confirm({
        message: `Found ${existingVar} in environment. Use it for ${provider.label}?`,
        initialValue: true,
      });
      if (useExisting) {
        await prompter.note(`Using existing ${existingVar} for ${provider.label}.`, "Studio");
        nextConfig = enablePluginInConfig(nextConfig, provider.pluginId);
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
      // Store the key — use the credential storage system
      const envVar = provider.envVars[0];
      if (envVar) {
        // Set in current process so subsequent steps can see it
        env[envVar] = apiKey.trim();
      }
      nextConfig = enablePluginInConfig(nextConfig, provider.pluginId);
      await prompter.note(`${provider.label} configured.`, "Studio");
    }
  }

  // Enable the studio extension itself
  nextConfig = enablePluginInConfig(nextConfig, "gods-eye-studio");

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
