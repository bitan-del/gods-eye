# Gods Eye Online MCP Connector

## Architecture

```
Gods Eye Online (web app)
        |
        | HTTP-SSE (MCP protocol)
        v
Gods Eye Fork (local brain)
        |
        |-- fal.ai (image/video gen)
        |-- AI agent (chat, reasoning)
        |-- Web search
        |-- Brand analysis
```

The local Gods Eye fork acts as the **brain** — it holds all API keys,
runs the AI agent, and executes tool calls. Gods Eye Online sends
requests via MCP and receives results.

## Quick Start

### 1. Start the local gateway

```bash
godseye gateway run --bind loopback --port 18789 --force
```

### 2. Start the HTTP-SSE bridge

```bash
# From repo root
bun extensions/gods-eye-online/src/http-bridge.ts
```

This starts a bridge server on port **18790** (configurable via
`GODSEYE_ONLINE_BRIDGE_PORT`).

### 3. Connect from Gods Eye Online

In Gods Eye Online, configure the MCP connection:

```json
{
  "mcpServers": {
    "gods-eye-brain": {
      "url": "http://localhost:18790/sse"
    }
  }
}
```

Or for remote connections (e.g. via Tailscale/ngrok):

```json
{
  "mcpServers": {
    "gods-eye-brain": {
      "url": "http://<your-ip>:18790/sse"
    }
  }
}
```

## Available Tools

| Tool             | Description                                                     |
| ---------------- | --------------------------------------------------------------- |
| `generate_image` | Image generation via fal.ai (Flux, Nano Banana, Imagen 4, etc.) |
| `generate_video` | Video generation via fal.ai                                     |
| `chat`           | Send messages to the local AI agent                             |
| `search_web`     | Web search via configured provider                              |
| `analyze_brand`  | Brand DNA extraction from URL or text                           |
| `list_models`    | List available AI models                                        |
| `get_status`     | Gateway health and connection status                            |

## Environment Variables

| Variable                     | Default                  | Description                              |
| ---------------------------- | ------------------------ | ---------------------------------------- |
| `FAL_KEY`                    | —                        | fal.ai API key (required for generation) |
| `GODSEYE_GATEWAY_URL`        | `http://localhost:18789` | Local gateway URL                        |
| `GODSEYE_ONLINE_BRIDGE_PORT` | `18790`                  | HTTP bridge port                         |

## Stdio Transport (for CLI/agent use)

```bash
bun extensions/gods-eye-online/src/mcp-server.ts
```

This starts a stdio MCP server (used when Gods Eye Online connects
via the CLI/agent path rather than HTTP).
