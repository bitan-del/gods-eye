/**
 * Gods Eye Online Connector Plugin
 *
 * Bridges the local Gods Eye fork (brain) to the Gods Eye Online web platform
 * via MCP (Model Context Protocol).
 *
 * Architecture:
 *   Gods Eye Online (web) --MCP--> local Gods Eye fork (brain)
 *
 * The local fork handles:
 *   - Image generation (fal.ai)
 *   - Video generation (fal.ai)
 *   - AI chat / agent orchestration
 *   - Web search
 *   - Brand analysis
 *
 * Gods Eye Online sends requests via MCP tools and the local fork
 * executes them using its configured API keys and capabilities.
 *
 * MCP Server: src/mcp-server.ts (stdio transport)
 * HTTP Bridge: src/http-bridge.ts (SSE transport for web clients)
 */

export const PLUGIN_ID = "gods-eye-online";
export const PLUGIN_VERSION = "0.1.0";
