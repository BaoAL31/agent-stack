import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const SERVER_NAMES = ["filesystem", "git", "fetch", "sqlite", "puppeteer", "playwright"] as const;
type ServerName = (typeof SERVER_NAMES)[number];

const isWindows = process.platform === "win32";
const npx = "npx";
const home = process.env.HOME || process.env.USERPROFILE || process.cwd();

function npxCommand(): string {
  return isWindows ? "cmd.exe" : npx;
}

function npxArgs(args: string[]): string[] {
  return isWindows ? ["/C", npx, ...args] : args;
}

type ServerConfig = {
  description: string;
  command: string;
  args: string[];
};

const SERVERS: Record<ServerName, ServerConfig> = {
  filesystem: {
    description: "Filesystem MCP server. Allowed root defaults to the current project cwd.",
    command: npxCommand(),
    args: npxArgs(["-y", "@modelcontextprotocol/server-filesystem", process.env.PI_MCP_FILESYSTEM_ROOT ?? process.cwd()]),
  },
  git: {
    description: "Git MCP server for repository operations.",
    command: npxCommand(),
    args: npxArgs(["-y", "@cyanheads/git-mcp-server"]),
  },
  fetch: {
    description: "Web fetch MCP server for URLs and web content.",
    command: npxCommand(),
    args: npxArgs(["-y", "mcp-fetch-server"]),
  },
  sqlite: {
    description: "SQLite MCP server for local database files.",
    command: npxCommand(),
    args: npxArgs(["-y", "mcp-server-sqlite"]),
  },
  puppeteer: {
    description: "Browser automation MCP server backed by Puppeteer.",
    command: npxCommand(),
    args: npxArgs(["-y", "@hisma/server-puppeteer"]),
  },
  playwright: {
    description: "Browser automation MCP server backed by Playwright (accessibility-tree snapshots).",
    command: isWindows ? "node" : "npx",
    args: isWindows
      ? ["C:\\Users\\jembo\\AppData\\Roaming\\npm\\node_modules\\@playwright\\mcp\\cli.js", "--headless", "--no-sandbox", "--browser", "chrome"]
      : ["-y", "@playwright/mcp", "--headless", "--no-sandbox", "--browser", "chrome"],
  },
};

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type Pending = {
  resolve: (value: JsonValue | undefined) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

class McpClient {
  private child: ChildProcessWithoutNullStreams;
  private id = 0;
  private buffer = "";
  private stderrBuffer = "";
  private closed = false;
  private readonly pending = new Map<number, Pending>();

  constructor(private readonly config: ServerConfig) {
    this.child = spawn(config.command, config.args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.child.stdout.on("data", (chunk: Buffer) => this.onStdout(chunk));
    this.child.stderr.on("data", (chunk: Buffer) => {
      this.stderrBuffer += chunk.toString("utf8");
      if (this.stderrBuffer.length > 20000) this.stderrBuffer = this.stderrBuffer.slice(-20000);
    });
    this.child.on("exit", (code, signal) => {
      this.closed = true;
      const error = new Error(`MCP server exited code=${code ?? "null"} signal=${signal ?? "null"}`);
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(error);
      }
      this.pending.clear();
    });
    this.child.on("error", (error) => {
      this.closed = true;
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(error);
      }
      this.pending.clear();
    });
  }

  async initialize(): Promise<void> {
    const result = await this.send("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "pi-mcp-tools", version: "0.1.0" },
    });
    await this.sendNotification("notifications/initialized", {});
    if (typeof result === "object" && result !== null && "protocolVersion" in result) {
      return;
    }
  }

  async listTools(): Promise<string> {
    const result = await this.send("tools/list", {});
    const tools = Array.isArray((result as { tools?: unknown })?.tools) ? (result as { tools: unknown[] }).tools : [];
    return tools
      .map((tool: unknown) => {
        const t = tool as { name?: unknown; description?: unknown; inputSchema?: unknown };
        return [
          `- ${String(t.name ?? "unnamed")}: ${String(t.description ?? "")}`.trim(),
          t.inputSchema ? `  inputSchema: ${JSON.stringify(t.inputSchema)}` : "",
        ].filter(Boolean).join("\n");
      })
      .join("\n\n") || "No MCP tools returned.";
  }

  async callTool(name: string, args?: Record<string, unknown>): Promise<string> {
    const result = await this.send("tools/call", { name, arguments: args ?? {} });
    return stringifyToolResult(result);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    try {
      this.child.kill();
    } catch {
      // Ignore close errors.
    }
  }

  private send(method: string, params: unknown, timeoutMs = 30000): Promise<JsonValue | undefined> {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for MCP response: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value); }, reject: (error) => { clearTimeout(timer); reject(error); }, timer });
      this.write({ jsonrpc: "2.0", id, method, params });
    });
  }

  private sendNotification(method: string, params: unknown): void {
    if (!this.closed) this.write({ jsonrpc: "2.0", method, params });
  }

  private write(message: unknown): void {
    if (this.closed) return;
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private onStdout(chunk: Buffer): void {
    this.buffer += chunk.toString("utf8");
    let newlineIndex: number;
    while ((newlineIndex = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);
      if (!line) continue;
      try {
        const message = JSON.parse(line) as { id?: unknown; error?: unknown; result?: unknown; method?: unknown };
        if (typeof message.id === "number" && this.pending.has(message.id)) {
          const pending = this.pending.get(message.id)!;
          this.pending.delete(message.id);
          clearTimeout(pending.timer);
          if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
          else pending.resolve(message.result as JsonValue | undefined);
        }
      } catch {
        // Ignore non-MCP JSON lines, such as server logs.
      }
    }
  }
}

function stringifyToolResult(result: unknown): string {
  const r = result as { content?: unknown[]; isError?: unknown; _meta?: unknown };
  const content = Array.isArray(r.content) ? r.content : [];
  const text = content.map((item) => {
    const i = item as { type?: unknown; text?: unknown; data?: unknown; mimeType?: unknown; resource?: unknown };
    if (i.type === "text" && typeof i.text === "string") return i.text;
    if (i.type === "resource" && typeof i.resource === "object" && i.resource !== null) {
      const resource = i.resource as { uri?: unknown; mimeType?: unknown; text?: unknown };
      const header = [`resource`, resource.uri && `uri=${resource.uri}`, resource.mimeType && `mimeType=${resource.mimeType}`].filter(Boolean).join(" ");
      return `${header}\n${typeof resource.text === "string" ? resource.text : JSON.stringify(resource)}`;
    }
    if (i.type === "image" && typeof i.mimeType === "string" && typeof i.data === "string") {
      return `[image ${i.mimeType}; base64 length=${i.data.length}]`;
    }
    return JSON.stringify(item);
  }).join("\n");

  const meta = r._meta ? `\n\n_meta: ${JSON.stringify(r._meta)}` : "";
  const error = r.isError ? `\n\n[tool reported isError=true]` : "";
  return `${text || JSON.stringify(result)}${error}${meta}`.trim();
}

function getServer(server: ServerName) {
  const config = SERVERS[server];
  if (!config) throw new Error(`Unknown MCP server: ${server}`);
  return config;
}

async function withClient<T>(server: ServerName, fn: (client: McpClient) => Promise<T>): Promise<T> {
  const client = new McpClient(getServer(server));
  try {
    await client.initialize();
    return await fn(client);
  } finally {
    client.close();
  }
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async () => {
    const active = pi.getActiveTools();
    pi.setActiveTools([...new Set([...active, "mcp_list_tools", "mcp_tool"])]);
  });

  pi.registerTool({
    name: "mcp_list_tools",
    label: "List MCP tools",
    description: "List available tools from an installed MCP server.",
    promptSnippet: "Discover tools exposed by filesystem, git, fetch, sqlite, puppeteer, or playwright MCP servers",
    promptGuidelines: [
      "Use mcp_list_tools with server filesystem, git, fetch, sqlite, or puppeteer before calling mcp_tool.",
      "Read the returned MCP tool names and inputSchema values, then pass matching arguments to mcp_tool."
    ],
    parameters: Type.Object({
      server: StringEnum(SERVER_NAMES),
    }),
    async execute(_toolCallId, params) {
      return withClient(params.server, (client) => client.listTools())
        .then((content) => ({ content: [{ type: "text", text: content }], details: { server: params.server } }))
        .catch((error: Error) => {
          throw new Error(`mcp_list_tools failed for ${params.server}: ${error.message}`);
        });
    },
  });

  pi.registerTool({
    name: "mcp_tool",
    label: "Call MCP tool",
    description: "Call a specific tool from an installed MCP server.",
    promptSnippet: "Call a listed MCP server tool with JSON arguments",
    promptGuidelines: [
      "Use mcp_tool only after mcp_list_tools shows the target MCP tool name.",
      "Use mcp_tool server filesystem for file reads/searches inside the current project cwd.",
      "Use mcp_tool server git for repository operations when a Git MCP tool is listed.",
      "Use mcp_tool server fetch for URL fetching when a fetch MCP tool is listed.",
      "Use mcp_tool server sqlite with database path and SQL arguments when a sqlite MCP tool is listed.",
      "Use mcp_tool server puppeteer for browser automation when a puppeteer MCP tool is listed.",
      "Use mcp_tool server playwright for LLM-legible browser navigation (accessibility-tree snapshots) when a playwright MCP tool is listed."
    ],
    parameters: Type.Object({
      server: StringEnum(SERVER_NAMES),
      tool: Type.String({ description: "Exact MCP tool name returned by mcp_list_tools" }),
      arguments: Type.Optional(Type.Record(Type.String(), Type.Any())),
    }),
    async execute(_toolCallId, params) {
      return withClient(params.server, (client) => client.callTool(params.tool, params.arguments))
        .then((content) => ({
          content: [{ type: "text", text: content }],
          details: { server: params.server, tool: params.tool, arguments: params.arguments ?? {} },
        }))
        .catch((error: Error) => {
          throw new Error(`mcp_tool failed for ${params.server}/${params.tool}: ${error.message}`);
        });
    },
  });
}
