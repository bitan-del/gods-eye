#!/usr/bin/env node
import { execSync } from "node:child_process";
/**
 * Memory Graph MCP Bridge
 *
 * A Node.js MCP server that provides persistent codebase knowledge and
 * conversation memory. Works in two modes:
 *
 * 1. Standalone (built-in): Uses a lightweight SQLite-based graph for
 *    file structure, symbols, and conversation memory.
 * 2. Enhanced (code-review-graph): Delegates to the Python code-review-graph
 *    MCP server for full AST-level analysis when available.
 *
 * The bridge always provides conversation memory tools regardless of mode.
 */
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { createInterface } from "node:readline";

// ─── Configuration ──────────────────────────────────────────────────────────
const WORKSPACE = process.env.GODSEYE_WORKSPACE || process.cwd();
const DATA_DIR = join(WORKSPACE, ".godseye", "memory-graph");
const DB_PATH = join(DATA_DIR, "graph.json");
const MEMORY_PATH = join(DATA_DIR, "memory.json");
const EXCLUDE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "__pycache__",
  ".venv",
  "venv",
  ".godseye",
  ".code-review-graph",
  "coverage",
  ".turbo",
  ".cache",
  ".parcel-cache",
]);
const INDEX_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".swift",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".cs",
  ".rb",
  ".vue",
  ".svelte",
  ".astro",
]);
const MAX_DEPTH = 12;
const MAX_FILES = 50000;

// ─── Ensure data directory ──────────────────────────────────────────────────
mkdirSync(DATA_DIR, { recursive: true });

// ─── Graph Store ────────────────────────────────────────────────────────────
class GraphStore {
  constructor() {
    this.files = {}; // path → { symbols, imports, hash, mtime }
    this.symbols = {}; // qualifiedName → { kind, name, file, line, endLine }
    this.edges = []; // { kind, source, target, file }
    this.memory = []; // conversation memories
    this.stats = { files: 0, symbols: 0, edges: 0, lastIndexed: null };
    this.load();
  }

  load() {
    try {
      if (existsSync(DB_PATH)) {
        const data = JSON.parse(readFileSync(DB_PATH, "utf-8"));
        this.files = data.files || {};
        this.symbols = data.symbols || {};
        this.edges = data.edges || [];
        this.stats = data.stats || this.stats;
      }
    } catch {
      /* fresh start */
    }
    try {
      if (existsSync(MEMORY_PATH)) {
        this.memory = JSON.parse(readFileSync(MEMORY_PATH, "utf-8"));
      }
    } catch {
      /* fresh start */
    }
  }

  save() {
    writeFileSync(
      DB_PATH,
      JSON.stringify(
        {
          files: this.files,
          symbols: this.symbols,
          edges: this.edges,
          stats: this.stats,
        },
        null,
        2,
      ),
    );
  }

  saveMemory() {
    writeFileSync(MEMORY_PATH, JSON.stringify(this.memory, null, 2));
  }

  /** Index the workspace incrementally */
  indexWorkspace(rootDir = WORKSPACE) {
    const startTime = Date.now();
    let fileCount = 0;
    let newSymbols = 0;

    const walk = (dir, depth = 0) => {
      if (depth > MAX_DEPTH || fileCount > MAX_FILES) return;
      let entries;
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (fileCount > MAX_FILES) break;
        const fullPath = join(dir, entry.name);
        const relPath = relative(rootDir, fullPath);

        if (entry.isDirectory()) {
          if (!EXCLUDE_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
            walk(fullPath, depth + 1);
          }
          continue;
        }

        if (!entry.isFile()) continue;
        const ext = extname(entry.name);
        if (!INDEX_EXTENSIONS.has(ext)) continue;

        fileCount++;
        let stat;
        try {
          stat = statSync(fullPath);
        } catch {
          continue;
        }

        const mtime = stat.mtimeMs;
        const existing = this.files[relPath];
        if (existing && existing.mtime === mtime) continue;

        // Parse file for symbols
        const parsed = this.parseFile(fullPath, relPath, ext);
        this.files[relPath] = { ...parsed, mtime };
        newSymbols += parsed.symbols.length;
      }
    };

    walk(rootDir);

    // Rebuild symbol index
    this.symbols = {};
    this.edges = [];
    for (const [filePath, fileData] of Object.entries(this.files)) {
      for (const sym of fileData.symbols || []) {
        const qName = `${filePath}::${sym.name}`;
        this.symbols[qName] = { ...sym, file: filePath };
      }
      for (const imp of fileData.imports || []) {
        this.edges.push({ kind: "IMPORTS", source: filePath, target: imp });
      }
    }

    this.stats = {
      files: Object.keys(this.files).length,
      symbols: Object.keys(this.symbols).length,
      edges: this.edges.length,
      lastIndexed: new Date().toISOString(),
      indexTimeMs: Date.now() - startTime,
    };

    this.save();
    return { filesScanned: fileCount, newSymbols, ...this.stats };
  }

  /** Lightweight symbol extraction using regex (no AST) */
  parseFile(fullPath, relPath, ext) {
    const symbols = [];
    const imports = [];
    let content;
    try {
      content = readFileSync(fullPath, "utf-8");
    } catch {
      return { symbols: [], imports: [] };
    }

    const lines = content.split("\n");
    const lang = this.langFromExt(ext);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trimStart();

      // Functions
      if (lang === "ts" || lang === "js") {
        const fnMatch = trimmed.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
        if (fnMatch) {
          symbols.push({ kind: "function", name: fnMatch[1], line: i + 1 });
          continue;
        }
        const arrowMatch = trimmed.match(
          /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_]\w*)\s*=>/,
        );
        if (arrowMatch) {
          symbols.push({ kind: "function", name: arrowMatch[1], line: i + 1 });
          continue;
        }
        const classMatch = trimmed.match(/^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/);
        if (classMatch) {
          symbols.push({ kind: "class", name: classMatch[1], line: i + 1 });
          continue;
        }
        const typeMatch = trimmed.match(/^(?:export\s+)?(?:type|interface)\s+(\w+)/);
        if (typeMatch) {
          symbols.push({ kind: "type", name: typeMatch[1], line: i + 1 });
          continue;
        }
        const importMatch = trimmed.match(/^import\s+.*from\s+["']([^"']+)["']/);
        if (importMatch && !importMatch[1].startsWith(".")) {
          imports.push(importMatch[1]);
        }
      } else if (lang === "python") {
        const defMatch = trimmed.match(/^(?:async\s+)?def\s+(\w+)/);
        if (defMatch) {
          symbols.push({ kind: "function", name: defMatch[1], line: i + 1 });
          continue;
        }
        const pyClassMatch = trimmed.match(/^class\s+(\w+)/);
        if (pyClassMatch) {
          symbols.push({ kind: "class", name: pyClassMatch[1], line: i + 1 });
          continue;
        }
      } else if (lang === "go") {
        const goFnMatch = trimmed.match(/^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)/);
        if (goFnMatch) {
          symbols.push({ kind: "function", name: goFnMatch[1], line: i + 1 });
          continue;
        }
        const goTypeMatch = trimmed.match(/^type\s+(\w+)\s+(?:struct|interface)/);
        if (goTypeMatch) {
          symbols.push({ kind: "type", name: goTypeMatch[1], line: i + 1 });
          continue;
        }
      } else if (lang === "rust") {
        const rsFnMatch = trimmed.match(/^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/);
        if (rsFnMatch) {
          symbols.push({ kind: "function", name: rsFnMatch[1], line: i + 1 });
          continue;
        }
        const rsStructMatch = trimmed.match(/^(?:pub\s+)?(?:struct|enum|trait)\s+(\w+)/);
        if (rsStructMatch) {
          symbols.push({ kind: "type", name: rsStructMatch[1], line: i + 1 });
          continue;
        }
      }
    }

    return { symbols, imports };
  }

  langFromExt(ext) {
    if ([".ts", ".tsx", ".mjs", ".cjs"].includes(ext)) return "ts";
    if ([".js", ".jsx"].includes(ext)) return "js";
    if (ext === ".py") return "python";
    if (ext === ".go") return "go";
    if (ext === ".rs") return "rust";
    if ([".java", ".kt"].includes(ext)) return "java";
    return "other";
  }

  /** Search symbols by name */
  searchSymbols(query, limit = 20) {
    const q = query.toLowerCase();
    const results = [];
    for (const [qName, sym] of Object.entries(this.symbols)) {
      if (qName.toLowerCase().includes(q) || sym.name.toLowerCase().includes(q)) {
        results.push({ qualifiedName: qName, ...sym });
        if (results.length >= limit) break;
      }
    }
    return results;
  }

  /** Get file structure overview */
  getStructure(path = "") {
    const prefix = path ? path + "/" : "";
    const dirs = new Map();
    const fileList = [];

    for (const filePath of Object.keys(this.files)) {
      if (prefix && !filePath.startsWith(prefix)) continue;
      const rel = prefix ? filePath.slice(prefix.length) : filePath;
      const parts = rel.split("/");
      if (parts.length > 1) {
        const dir = parts[0];
        dirs.set(dir, (dirs.get(dir) || 0) + 1);
      } else {
        fileList.push({ path: filePath, symbols: (this.files[filePath]?.symbols || []).length });
      }
    }

    return {
      directories: Array.from(dirs.entries()).map(([name, count]) => ({ name, fileCount: count })),
      files: fileList.slice(0, 50),
    };
  }

  /** Get impact radius for a file (which files import/depend on it) */
  getImpactRadius(filePath, depth = 2) {
    const affected = new Set();
    const queue = [{ path: filePath, hop: 0 }];

    while (queue.length > 0) {
      const { path: current, hop } = queue.shift();
      if (hop > depth) continue;
      if (affected.has(current)) continue;
      affected.add(current);

      // Find files that import this file
      for (const edge of this.edges) {
        if (edge.target.includes(basename(current, extname(current)))) {
          if (!affected.has(edge.source)) {
            queue.push({ path: edge.source, hop: hop + 1 });
          }
        }
      }
    }

    affected.delete(filePath);
    return Array.from(affected);
  }

  /** Store a conversation memory */
  addMemory(entry) {
    this.memory.push({
      ...entry,
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
    });
    // Keep last 1000 memories
    if (this.memory.length > 1000) {
      this.memory = this.memory.slice(-1000);
    }
    this.saveMemory();
    return this.memory[this.memory.length - 1];
  }

  /** Search conversation memories */
  searchMemory(query, limit = 10) {
    const q = query.toLowerCase();
    return this.memory
      .filter(
        (m) =>
          (m.content || "").toLowerCase().includes(q) ||
          (m.summary || "").toLowerCase().includes(q) ||
          (m.tags || []).some((t) => t.toLowerCase().includes(q)),
      )
      .slice(-limit)
      .reverse();
  }

  /** Get recent memories */
  recentMemories(limit = 20) {
    return this.memory.slice(-limit).reverse();
  }
}

// ─── MCP Server (JSON-RPC over stdio) ───────────────────────────────────────
const graph = new GraphStore();

// Auto-index on startup
if (process.argv.includes("--build-only")) {
  const result = graph.indexWorkspace();
  process.stderr.write(`[memory-graph] Indexed: ${JSON.stringify(result)}\n`);
  process.exit(0);
}

// Index in background on start
setTimeout(() => {
  try {
    const result = graph.indexWorkspace();
    process.stderr.write(
      `[memory-graph] Background index: ${result.files} files, ${result.symbols} symbols in ${result.indexTimeMs}ms\n`,
    );
  } catch (err) {
    process.stderr.write(`[memory-graph] Index error: ${err}\n`);
  }
}, 100);

const TOOLS = [
  {
    name: "memory_graph_status",
    description:
      "Get the current status of the memory graph — file count, symbol count, edge count, and last indexed timestamp.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "memory_graph_search_code",
    description:
      "Search for code symbols (functions, classes, types) by name across the indexed codebase.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Symbol name or partial match to search for" },
        limit: { type: "number", description: "Max results (default: 20)" },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "memory_graph_file_structure",
    description: "Get the directory structure and file listing for a path in the codebase.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Directory path relative to workspace root (empty for root)",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "memory_graph_impact_radius",
    description:
      "Find all files that would be affected by changes to a given file (blast radius analysis).",
    inputSchema: {
      type: "object",
      properties: {
        file: { type: "string", description: "File path relative to workspace root" },
        depth: { type: "number", description: "Max dependency hops (default: 2)" },
      },
      required: ["file"],
      additionalProperties: false,
    },
  },
  {
    name: "memory_graph_file_symbols",
    description: "List all symbols (functions, classes, types) defined in a specific file.",
    inputSchema: {
      type: "object",
      properties: {
        file: { type: "string", description: "File path relative to workspace root" },
      },
      required: ["file"],
      additionalProperties: false,
    },
  },
  {
    name: "memory_graph_reindex",
    description: "Re-index the workspace to pick up new or changed files.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "memory_store",
    description:
      "Store a piece of information in persistent memory that will survive across sessions and context resets. Use this for important context, decisions, user preferences, or findings.",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string", description: "The information to remember" },
        summary: { type: "string", description: "A short one-line summary for search" },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags for categorization (e.g., 'bug', 'architecture', 'user-preference')",
        },
        category: {
          type: "string",
          description: "Category: 'decision', 'finding', 'preference', 'context', 'todo', 'bug'",
        },
      },
      required: ["content", "summary"],
      additionalProperties: false,
    },
  },
  {
    name: "memory_recall",
    description:
      "Search persistent memory for previously stored information. Use this to recall decisions, findings, user preferences, or past context.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query to find relevant memories" },
        limit: { type: "number", description: "Max results (default: 10)" },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "memory_recent",
    description:
      "Get the most recent memories stored. Useful to pick up context from previous sessions.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Number of recent memories (default: 20)" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "memory_context_for_file",
    description:
      "Get full context about a file: its symbols, what imports it, what it imports, and any related memories. This is the primary tool for efficient code understanding without reading entire files.",
    inputSchema: {
      type: "object",
      properties: {
        file: { type: "string", description: "File path relative to workspace root" },
      },
      required: ["file"],
      additionalProperties: false,
    },
  },
];

function handleToolCall(name, args) {
  switch (name) {
    case "memory_graph_status":
      return { content: [{ type: "text", text: JSON.stringify(graph.stats, null, 2) }] };

    case "memory_graph_search_code":
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(graph.searchSymbols(args.query, args.limit || 20), null, 2),
          },
        ],
      };

    case "memory_graph_file_structure":
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(graph.getStructure(args.path || ""), null, 2),
          },
        ],
      };

    case "memory_graph_impact_radius":
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(graph.getImpactRadius(args.file, args.depth || 2), null, 2),
          },
        ],
      };

    case "memory_graph_file_symbols": {
      const fileData = graph.files[args.file];
      if (!fileData) {
        return { content: [{ type: "text", text: `File not found in index: ${args.file}` }] };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(fileData.symbols, null, 2),
          },
        ],
      };
    }

    case "memory_graph_reindex": {
      const result = graph.indexWorkspace();
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    case "memory_store": {
      const entry = graph.addMemory({
        content: args.content,
        summary: args.summary,
        tags: args.tags || [],
        category: args.category || "context",
      });
      return { content: [{ type: "text", text: `Stored memory: ${entry.id}\n${entry.summary}` }] };
    }

    case "memory_recall":
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(graph.searchMemory(args.query, args.limit || 10), null, 2),
          },
        ],
      };

    case "memory_recent":
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(graph.recentMemories(args.limit || 20), null, 2),
          },
        ],
      };

    case "memory_context_for_file": {
      const file = args.file;
      const fileData = graph.files[file];
      const symbols = fileData?.symbols || [];
      const imports = fileData?.imports || [];
      const dependents = graph.getImpactRadius(file, 1);
      const memories = graph.searchMemory(basename(file, extname(file)), 5);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                file,
                symbols,
                imports,
                dependents,
                relatedMemories: memories,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    default:
      return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
  }
}

// ─── JSON-RPC stdio transport ───────────────────────────────────────────────
const rl = createInterface({ input: process.stdin, terminal: false });
let buffer = "";

function sendResponse(response) {
  const json = JSON.stringify(response);
  const header = `Content-Length: ${Buffer.byteLength(json)}\r\n\r\n`;
  process.stdout.write(header + json);
}

function handleMessage(message) {
  const { id, method, params } = message;

  switch (method) {
    case "initialize":
      sendResponse({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          serverInfo: {
            name: "memory-graph",
            version: "0.1.0",
          },
          capabilities: {
            tools: {},
          },
        },
      });
      break;

    case "notifications/initialized":
      // No response needed for notifications
      break;

    case "tools/list":
      sendResponse({
        jsonrpc: "2.0",
        id,
        result: { tools: TOOLS },
      });
      break;

    case "tools/call": {
      const { name, arguments: args } = params || {};
      try {
        const result = handleToolCall(name, args || {});
        sendResponse({ jsonrpc: "2.0", id, result });
      } catch (err) {
        sendResponse({
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: `Error: ${err.message || err}` }],
            isError: true,
          },
        });
      }
      break;
    }

    default:
      if (id != null) {
        sendResponse({
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        });
      }
  }
}

// Parse MCP messages (Content-Length framing)
process.stdin.on("data", (chunk) => {
  buffer += chunk.toString();

  while (true) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) break;

    const header = buffer.slice(0, headerEnd);
    const lengthMatch = header.match(/Content-Length:\s*(\d+)/i);
    if (!lengthMatch) {
      buffer = buffer.slice(headerEnd + 4);
      continue;
    }

    const contentLength = parseInt(lengthMatch[1], 10);
    const contentStart = headerEnd + 4;
    if (buffer.length < contentStart + contentLength) break;

    const content = buffer.slice(contentStart, contentStart + contentLength);
    buffer = buffer.slice(contentStart + contentLength);

    try {
      const message = JSON.parse(content);
      handleMessage(message);
    } catch (err) {
      process.stderr.write(`[memory-graph] Parse error: ${err}\n`);
    }
  }
});

process.stderr.write("[memory-graph] MCP server started\n");
