---
title: Getting Started with Gods Eye Studio
description: Set up creative tools for image generation, video generation, brand intelligence, and content calendar.
---

# Getting Started with Gods Eye Studio

Gods Eye Studio adds creative capabilities to your assistant: image generation, video generation, brand scanning, and content calendar management. All generations are stored in creative memory so your assistant always has context about your brand, style, and history.

## Prerequisites

Studio uses a BYOK (bring your own keys) model. You need at least one API key from a supported creative provider:

| Provider | Key | What it enables |
| --- | --- | --- |
| [fal.ai](https://fal.ai) | `FAL_KEY` | Image generation (Flux), video generation (Minimax) |
| [Google Gemini](https://aistudio.google.com/apikey) | `GEMINI_API_KEY` or `GOOGLE_API_KEY` | Brand analysis, creative reasoning, Imagen |
| [OpenAI](https://platform.openai.com/api-keys) | `OPENAI_API_KEY` | GPT Image, DALL-E 3 |

You do not need all three. One provider is enough to start generating.

## Setup via onboarding

The recommended way to configure Studio is through the onboarding wizard:

```bash
godseye onboard
```

During onboarding, the **Creative tools** step prompts you for each provider key. Existing keys in your environment are detected automatically and you can skip providers you do not use.

## Manual setup via config

If you prefer to configure keys manually:

```bash
# fal.ai
godseye config set secrets.FAL_KEY "your-fal-key"

# Google Gemini
godseye config set secrets.GEMINI_API_KEY "your-gemini-key"

# OpenAI (if not already set for your main LLM provider)
godseye config set secrets.OPENAI_API_KEY "your-openai-key"
```

You can also set environment variables directly (`FAL_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`). Studio checks both the config store and environment.

### Plugin configuration

Studio-specific settings live under the `gods-eye-studio` plugin config:

```json
{
  "plugins": {
    "gods-eye-studio": {
      "brain": {
        "autoContext": true,
        "memoryDbPath": "~/.godseye/brain/index.db"
      },
      "defaults": {
        "imageModel": "fal-ai/flux/dev",
        "videoModel": "fal-ai/minimax/video-01-live"
      }
    }
  }
}
```

- **`brain.autoContext`** (default `true`): inject brand, generation history, and calendar context into every agent call automatically.
- **`brain.memoryDbPath`**: override the location of the brain database.
- **`defaults.imageModel`**: default model for image generation.
- **`defaults.videoModel`**: default model for video generation.

## First generation

Once at least one creative provider is configured, ask your assistant to generate:

```bash
godseye agent --message "generate a minimalist logo for a coffee shop called Brew & Bean"
```

The assistant calls the `studio_image_generate` tool, routes to the configured provider, and returns the result. The generation is automatically saved to creative memory at `~/.godseye/brain/generations/`.

## Brand scanning

Brand scanning extracts colors, typography, tone, and visual style from a website or description:

```bash
godseye agent --message "scan my brand from https://example.com"
```

This calls the `studio_brand_scan` tool, which:

1. Fetches and analyzes the target URL (using Gemini or another vision-capable provider).
2. Extracts a brand profile: primary/secondary/accent colors, fonts, tone, visual style.
3. Saves the profile to `~/.godseye/brain/brands/`.
4. Optionally sets it as the active brand.

Once a brand is active, all future generations automatically respect it. The assistant enriches every image prompt with your brand guidelines before sending it to the provider.

## Content calendar basics

The content calendar helps you plan, track, and publish creative assets:

```bash
godseye agent --message "create a content calendar slot for next Monday on Instagram"
godseye agent --message "show my content calendar for this week"
```

Each calendar slot tracks:

- **Date** and **platform** (Instagram, Twitter, LinkedIn, etc.)
- **Status**: ideated, generated, approved, or published
- **Linked generation**: connect an image or video to the slot

Calendar data is stored at `~/.godseye/brain/calendar/` and included in the creative context for every agent call (when `autoContext` is enabled).

## Next steps

- [Brain architecture](/studio/brain) — how creative memory works
- [Creative providers](/studio/providers) — detailed provider configuration and model routing
