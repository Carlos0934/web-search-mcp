// src/httpServer.ts
import { IncomingMessage, ServerResponse, createServer } from "http";
import { randomUUID } from "crypto";
import { Config } from "./config.js";
import { GoogleNewsSearchTool } from "./googleNewsSearch.js";
import { FetchPageTool } from "./fetchPage.js";
import { RateLimiter, BackoffManager } from "./rateLimit.js";
import { GoogleNewsSearchInput, FetchPageInput } from "./types.js";
import { MCPErrorException } from "./errors.js";

interface Session {
  id: string;
  createdAt: Date;
  lastAccessedAt: Date;
  initialized: boolean;
}

interface SSEStream {
  res: ServerResponse;
  sessionId: string;
  lastEventId: number;
  requestId?: string | number;
}

interface QueuedMessage {
  eventId: number;
  data: any;
  streamKey: string;
}

export class MCPHttpServer {
  private readonly config: Config;
  private readonly googleNewsSearch: GoogleNewsSearchTool;
  private readonly fetchPage: FetchPageTool;
  private readonly rateLimiter: RateLimiter;
  private readonly backoffManager: BackoffManager;

  private sessions: Map<string, Session> = new Map();
  private sseStreams: Map<string, SSEStream[]> = new Map();
  private messageQueues: Map<string, QueuedMessage[]> = new Map();
  private globalEventId = 0;

  constructor(config: Config) {
    this.config = config;
    this.googleNewsSearch = new GoogleNewsSearchTool(config);
    this.fetchPage = new FetchPageTool(config);
    this.rateLimiter = new RateLimiter(
      config.server.rateLimit.windowMs,
      config.server.rateLimit.max
    );
    this.backoffManager = new BackoffManager();

    // Clean up old sessions every hour
    setInterval(() => this.cleanupSessions(), 3600000);
  }

  private cleanupSessions(): void {
    const now = Date.now();
    const sessionTimeout = 3600000; // 1 hour

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastAccessedAt.getTime() > sessionTimeout) {
        this.sessions.delete(sessionId);
        this.sseStreams.delete(sessionId);
        this.messageQueues.delete(sessionId);
      }
    }
  }

  private validateOrigin(req: IncomingMessage): boolean {
    // In production, you should validate the Origin header
    // For now, we'll allow all origins (update this for production!)
    const origin = req.headers.origin;

    // For local development, allow localhost origins
    if (
      origin &&
      (origin.includes("localhost") ||
        origin.includes("127.0.0.1") ||
        origin.includes("0.0.0.0"))
    ) {
      return true;
    }

    // For production, implement proper origin validation
    return true; // TODO: Implement strict origin validation
  }

  private createSession(): Session {
    return {
      id: randomUUID(),
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      initialized: false,
    };
  }

  private getSession(sessionId: string | undefined): Session | null {
    if (!sessionId) return null;

    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastAccessedAt = new Date();
    }
    return session || null;
  }

  private sendSSE(stream: SSEStream, data: any, eventId?: number): void {
    const id = eventId ?? ++this.globalEventId;
    stream.lastEventId = id;

    stream.res.write(`id: ${id}\n`);
    stream.res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  private addSSEStream(sessionId: string, stream: SSEStream): void {
    if (!this.sseStreams.has(sessionId)) {
      this.sseStreams.set(sessionId, []);
    }
    this.sseStreams.get(sessionId)!.push(stream);
  }

  private removeSSEStream(sessionId: string, stream: SSEStream): void {
    const streams = this.sseStreams.get(sessionId);
    if (streams) {
      const index = streams.indexOf(stream);
      if (index > -1) {
        streams.splice(index, 1);
      }
    }
  }

  private async handleInitialize(
    params: any,
    sessionId?: string
  ): Promise<{ result: any; sessionId: string }> {
    let session: Session;

    if (sessionId && this.sessions.has(sessionId)) {
      session = this.sessions.get(sessionId)!;
    } else {
      session = this.createSession();
      this.sessions.set(session.id, session);
    }

    session.initialized = true;

    return {
      sessionId: session.id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: "news-tools",
          version: "1.0.0",
        },
      },
    };
  }

  private async handleToolsList(): Promise<any> {
    return {
      tools: [
        {
          name: "google_news_search",
          description:
            "Search recent news via Google CSE. Returns filtered, deduplicated results (primary articles preferred).",
          inputSchema: {
            type: "object",
            properties: {
              topic: {
                type: "string",
                description:
                  'Topic to search (e.g., "artificial intelligence").',
              },
              dateRestrict: {
                type: "string",
                description: "Freshness window: d1, d3, w1, m1.",
                default: "d3",
              },
              gl: {
                type: "string",
                description: "Country bias (e.g., us, gb, ca).",
                default: "us",
              },
              hl: {
                type: "string",
                description: "UI language.",
                default: "en",
              },
              lr: {
                type: "string",
                description: "Document language filter.",
                default: "lang_en",
              },
              num: {
                type: "integer",
                description: "Max results (<=10).",
                default: 8,
                minimum: 1,
                maximum: 10,
              },
              primaryOnly: {
                type: "boolean",
                description:
                  "Return only primary articles per selection policy.",
                default: true,
              },
            },
            required: ["topic"],
          },
        },
        {
          name: "fetch_page",
          description:
            "Fetch a URL and extract the main article content & metadata for summarization.",
          inputSchema: {
            type: "object",
            properties: {
              url: { type: "string", format: "uri" },
              timeoutMs: { type: "integer", default: 12000 },
              maxChars: { type: "integer", default: 12000 },
              language: {
                type: "string",
                description: "Expected language (ISO 639-1)",
                default: "en",
              },
            },
            required: ["url"],
          },
        },
      ],
    };
  }

  private async handleToolCall(name: string, args: any): Promise<any> {
    await this.rateLimiter.checkLimit("default-client");

    switch (name) {
      case "google_news_search": {
        const input = args as GoogleNewsSearchInput;
        return await this.backoffManager.withBackoff("google-cse", () =>
          this.googleNewsSearch.search(input)
        );
      }

      case "fetch_page": {
        const input = args as FetchPageInput;
        return await this.backoffManager.withBackoff(
          `fetch-${new URL(input.url).hostname}`,
          () => this.fetchPage.fetchPage(input)
        );
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private async processJsonRpcRequest(
    message: any,
    sessionId?: string
  ): Promise<{ response: any; sessionId?: string }> {
    const { jsonrpc, id, method, params } = message;

    if (jsonrpc !== "2.0") {
      throw { code: -32600, message: "Invalid Request: jsonrpc must be '2.0'" };
    }

    try {
      switch (method) {
        case "initialize": {
          const { result, sessionId: newSessionId } =
            await this.handleInitialize(params, sessionId);
          return {
            response: { jsonrpc: "2.0", id, result },
            sessionId: newSessionId,
          };
        }

        case "tools/list": {
          const result = await this.handleToolsList();
          return {
            response: { jsonrpc: "2.0", id, result },
          };
        }

        case "tools/call": {
          const { name, arguments: args } = params;
          const result = await this.handleToolCall(name, args);
          return {
            response: {
              jsonrpc: "2.0",
              id,
              result: {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(result, null, 2),
                  },
                ],
              },
            },
          };
        }

        case "ping": {
          return {
            response: { jsonrpc: "2.0", id, result: {} },
          };
        }

        default:
          throw { code: -32601, message: `Method not found: ${method}` };
      }
    } catch (error) {
      if (error instanceof MCPErrorException) {
        const mcpError = error.toMCPError();
        return {
          response: {
            jsonrpc: "2.0",
            id,
            error: {
              code: -32603,
              message: mcpError.message,
              data: mcpError.details,
            },
          },
        };
      }

      if (typeof error === "object" && error !== null && "code" in error) {
        return {
          response: {
            jsonrpc: "2.0",
            id,
            error: error as any,
          },
        };
      }

      return {
        response: {
          jsonrpc: "2.0",
          id,
          error: {
            code: -32603,
            message: String(error),
          },
        },
      };
    }
  }

  private setCORSHeaders(res: ServerResponse): void {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Accept, Mcp-Session-Id, Last-Event-ID"
    );
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
  }

  private async handlePost(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    const acceptHeader = req.headers.accept || "";
    const supportsSSE = acceptHeader.includes("text/event-stream");

    let body = "";
    req.on("data", (chunk) => (body += chunk.toString()));

    await new Promise<void>((resolve) => {
      req.on("end", async () => {
        try {
          const message = JSON.parse(body);
          const { response, sessionId: newSessionId } =
            await this.processJsonRpcRequest(message, sessionId);

          // Check if this is a notification or response (no id field means notification)
          if (!message.id) {
            res.writeHead(202);
            res.end();
            resolve();
            return;
          }

          // For requests, we can return either JSON or SSE
          if (supportsSSE) {
            // Return as SSE stream
            res.writeHead(200, {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
              ...(newSessionId ? { "Mcp-Session-Id": newSessionId } : {}),
            });

            const stream: SSEStream = {
              res,
              sessionId: newSessionId || sessionId || "default",
              lastEventId: 0,
              requestId: message.id,
            };

            if (newSessionId || sessionId) {
              this.addSSEStream(newSessionId || sessionId!, stream);
            }

            // Send the response
            this.sendSSE(stream, response);

            // Close the stream after sending response
            setTimeout(() => {
              res.end();
              if (newSessionId || sessionId) {
                this.removeSSEStream(newSessionId || sessionId!, stream);
              }
            }, 100);
          } else {
            // Return as JSON
            res.writeHead(200, {
              "Content-Type": "application/json",
              ...(newSessionId ? { "Mcp-Session-Id": newSessionId } : {}),
            });
            res.end(JSON.stringify(response));
          }
          resolve();
        } catch (error) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              error: {
                code: -32700,
                message: "Parse error",
                data: String(error),
              },
            })
          );
          resolve();
        }
      });
    });
  }

  private handleGet(req: IncomingMessage, res: ServerResponse): void {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    const lastEventId = req.headers["last-event-id"] as string | undefined;
    const acceptHeader = req.headers.accept || "";

    if (!acceptHeader.includes("text/event-stream")) {
      res.writeHead(405);
      res.end();
      return;
    }

    // Validate session if provided
    if (sessionId && !this.sessions.has(sessionId)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Session not found" }));
      return;
    }

    // Create SSE stream
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const stream: SSEStream = {
      res,
      sessionId: sessionId || "default",
      lastEventId: lastEventId ? parseInt(lastEventId, 10) : 0,
    };

    if (sessionId) {
      this.addSSEStream(sessionId, stream);

      // If resuming, replay messages after lastEventId
      if (lastEventId) {
        const queue = this.messageQueues.get(sessionId) || [];
        const lastId = parseInt(lastEventId, 10);

        for (const msg of queue) {
          if (msg.eventId > lastId) {
            this.sendSSE(stream, msg.data, msg.eventId);
          }
        }
      }
    }

    // Keep connection alive with periodic comments
    const keepAlive = setInterval(() => {
      res.write(": keepalive\n\n");
    }, 30000);

    req.on("close", () => {
      clearInterval(keepAlive);
      if (sessionId) {
        this.removeSSEStream(sessionId, stream);
      }
    });
  }

  private handleDelete(req: IncomingMessage, res: ServerResponse): void {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (!sessionId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing Mcp-Session-Id header" }));
      return;
    }

    if (this.sessions.has(sessionId)) {
      this.sessions.delete(sessionId);
      this.sseStreams.delete(sessionId);
      this.messageQueues.delete(sessionId);
      res.writeHead(200);
      res.end();
    } else {
      res.writeHead(404);
      res.end();
    }
  }

  public createHttpServer() {
    return createServer(async (req, res) => {
      this.setCORSHeaders(res);

      // Validate origin
      if (!this.validateOrigin(req)) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid origin" }));
        return;
      }

      if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
      }

      // Health check endpoint
      if (req.method === "GET" && req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            status: "healthy",
            timestamp: new Date().toISOString(),
            sessions: this.sessions.size,
          })
        );
        return;
      }

      // MCP endpoint
      if (req.url === "/mcp" || req.url === "/") {
        try {
          if (req.method === "POST") {
            await this.handlePost(req, res);
          } else if (req.method === "GET") {
            this.handleGet(req, res);
          } else if (req.method === "DELETE") {
            this.handleDelete(req, res);
          } else {
            res.writeHead(405);
            res.end();
          }
        } catch (error) {
          console.error("Request handling error:", error);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Internal server error" }));
        }
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    });
  }

  public async start(): Promise<void> {
    const port = this.config.server.port || 3000;
    const host = this.config.server.host || "127.0.0.1"; // Default to localhost for security

    const httpServer = this.createHttpServer();

    return new Promise((resolve) => {
      httpServer.listen(port, host, () => {
        console.log(`MCP HTTP Server listening on ${host}:${port}`);
        console.log(`MCP endpoint: http://${host}:${port}/mcp`);
        console.log(`Health check: http://${host}:${port}/health`);
        resolve();
      });
    });
  }
}
