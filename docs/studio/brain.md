---
title: Brain Architecture
description: How Gods Eye Studio stores and recalls creative memory across brands, generations, characters, and calendar.
---

# Brain Architecture

The brain is the persistent creative memory layer for Gods Eye Studio. It stores everything the assistant needs to generate brand-consistent content: brand profiles, generation history, character references, content calendar slots, and user preferences.

## What the brain stores

| Category | Description | Storage path |
| --- | --- | --- |
| **Brands** | Color palettes, fonts, tone, visual style, logos | `~/.godseye/brain/brands/` |
| **Generations** | Every image, video, and text generation with prompt, model, settings, tags | `~/.godseye/brain/generations/` |
| **Calendar** | Content slots with date, platform, status, and linked generations | `~/.godseye/brain/calendar/` |
| **Characters** | Named characters with descriptions, reference images, and style notes | `~/.godseye/brain/characters/` |
| **Preferences** | Default models, active brand, style preferences | `~/.godseye/brain/preferences.json` |

Each record is stored as an individual JSON file, making the data easy to inspect, back up, and version-control.

## Memory storage layout

```
~/.godseye/brain/
  brands/
    <brand-id>.json        # Brand profile (colors, fonts, tone, style)
  generations/
    <generation-id>.json   # Generation record (prompt, model, result ref, tags)
  calendar/
    <slot-id>.json         # Calendar slot (date, platform, status, linked generation)
  characters/
    <character-id>.json    # Character profile (name, description, reference images)
  preferences.json         # User preferences (default models, active brand)
  index.db                 # SQLite index for fast structured recall (optional)
```

## Context injection

The brain's most powerful feature is **automatic context injection**. When `brain.autoContext` is enabled (the default), Studio assembles a creative context block and prepends it to the agent's system prompt on every call. This means the LLM always knows:

- The **active brand** profile (colors, tone, visual style, fonts)
- **Recent generations** (last 5 by default) with their prompts and models
- **Upcoming calendar** slots (next 7 days)
- All **character** profiles

### How it works

1. Before each agent turn, Studio calls `buildCreativeContext()` to gather state from the brain.
2. The context is rendered as a structured system prompt section titled "Gods Eye Studio -- Creative Context."
3. The section includes the active brand details, recent generation summaries, upcoming calendar entries, and character references.
4. The agent sees this context alongside the normal system prompt and user message.

This eliminates the need for the user to re-state brand guidelines or recall past generations. The assistant just knows.

### Disabling auto-context

If you prefer to keep the system prompt lean, disable auto-context:

```bash
godseye config set plugins.gods-eye-studio.brain.autoContext false
```

You can still access brain data on demand using the `studio_recall` tool.

## Recall and search

The `studio_recall` tool provides keyword-based search across all creative memory:

```bash
godseye agent --message "recall my red logo generations from last week"
```

Recall searches across:

- **Generations**: prompt text, tags, model name, generation type
- **Brands**: name, tone, visual style
- **Characters**: name, description
- **Calendar**: notes, platform, status

Results are ranked by term-match score and returned with a snippet and type label. Future versions will support vector-based semantic search for more natural retrieval.

### Recall result shape

Each recall result contains:

- **type**: `generation`, `brand`, `character`, or `calendar`
- **id**: the record ID for follow-up actions
- **label**: a human-readable summary
- **snippet**: a short excerpt of the matching content
- **score**: relevance score (0 to 1)

## Customizing the brain path

By default the brain lives at `~/.godseye/brain/`. To change this:

```bash
godseye config set plugins.gods-eye-studio.brain.memoryDbPath "/path/to/custom/brain"
```

This is useful for keeping creative memory on an external drive or a synced folder.
