---
title: Creative Providers
description: Configure fal.ai, Google Gemini, and OpenAI for image generation, video generation, and brand analysis in Gods Eye Studio.
---

# Creative Providers

Gods Eye Studio supports three creative providers. Each covers different capabilities, and you can mix and match based on what you need.

## Provider overview

| Provider          | Image generation         | Video generation      | Brand analysis   | Default model                    |
| ----------------- | ------------------------ | --------------------- | ---------------- | -------------------------------- |
| **fal.ai**        | Flux (multiple variants) | Minimax Video-01-Live | --               | `fal-ai/flux/dev`                |
| **Google Gemini** | Imagen (preview)         | --                    | Gemini 2.5 Flash | `gemini-3.1-flash-image-preview` |
| **OpenAI**        | GPT Image, DALL-E 3      | --                    | --               | `gpt-image-1`                    |

## fal.ai

fal.ai is the default provider for both image and video generation. It offers fast inference across a wide range of open models.

### Supported capabilities

- **Image generation**: Flux Dev, Flux Pro, Flux Schnell, and other fal-hosted models
- **Video generation**: Minimax Video-01-Live with configurable duration and aspect ratio

### Configuration

```bash
godseye config set secrets.FAL_KEY "your-fal-key"
```

Or set the `FAL_KEY` environment variable.

### Default models

- Image: `fal-ai/flux/dev`
- Video: `fal-ai/minimax/video-01-live`

Override the defaults in your config:

```json
{
  "plugins": {
    "gods-eye-studio": {
      "defaults": {
        "imageModel": "fal-ai/flux-pro/v1.1",
        "videoModel": "fal-ai/minimax/video-01-live"
      }
    }
  }
}
```

Or specify a model per request:

```bash
godseye agent --message "generate a photo of a sunset using fal-ai/flux-pro/v1.1"
```

## Google Gemini

Gemini serves two roles in Studio: brand analysis (using Gemini 2.5 Flash) and image generation (using Imagen).

### Supported capabilities

- **Brand analysis**: extract colors, fonts, tone, and visual style from URLs or descriptions
- **Creative reasoning**: generate ideas, refine prompts, evaluate brand consistency
- **Image generation**: Imagen via `gemini-3.1-flash-image-preview`

### Configuration

```bash
godseye config set secrets.GEMINI_API_KEY "your-gemini-key"
```

Or set either `GEMINI_API_KEY` or `GOOGLE_API_KEY` as an environment variable. Studio checks both.

### Default models

- Analysis: `gemini-2.5-flash`
- Image: `gemini-3.1-flash-image-preview`

## OpenAI

OpenAI provides GPT Image and DALL-E 3 for image generation.

### Supported capabilities

- **Image generation**: GPT Image (`gpt-image-1`) and DALL-E 3 (`dall-e-3`)
- Quality and style controls (`low`, `medium`, `high`, `auto`)

### Configuration

```bash
godseye config set secrets.OPENAI_API_KEY "your-openai-key"
```

Or set the `OPENAI_API_KEY` environment variable. If you already use OpenAI as your main LLM provider, Studio reuses the same key.

### Default model

- `gpt-image-1`

## Model routing

Studio automatically routes generation requests to the correct provider based on the model name:

| Model pattern                                             | Routed to         |
| --------------------------------------------------------- | ----------------- |
| Starts with `dall-e` or `gpt-image`, or contains `openai` | **OpenAI**        |
| Contains `gemini` or `imagen`                             | **Google Gemini** |
| Everything else (default)                                 | **fal.ai**        |

This means you can request any model by name and Studio handles the rest:

```bash
# Routes to OpenAI
godseye agent --message "generate a logo using dall-e-3"

# Routes to Gemini
godseye agent --message "generate a banner using imagen"

# Routes to fal.ai (default)
godseye agent --message "generate a product photo"
```

### Overriding the default provider

Set a default image or video model in your config to change where requests go when no model is specified:

```bash
godseye config set plugins.gods-eye-studio.defaults.imageModel "gpt-image-1"
```

With this setting, unspecified image requests route to OpenAI instead of fal.ai.

## Brand-aware generation

Regardless of which provider handles the request, Studio automatically enriches prompts with your active brand context. If you have a brand profile with "warm earth tones, modern sans-serif typography, friendly professional tone," that context is woven into the generation prompt before it reaches the provider.

This works across all providers and all generation types (image, video, brand analysis).
