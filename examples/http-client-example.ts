// examples/http-client-example.ts
/**
 * Example HTTP client for the MCP News Tools server
 * Demonstrates session management, JSON-RPC requests, and SSE streaming
 */

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: any;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

class MCPHttpClient {
  private baseUrl: string;
  private sessionId: string | null = null;

  constructor(baseUrl: string = "http://localhost:3000") {
    this.baseUrl = baseUrl;
  }

  async initialize(): Promise<void> {
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: {
          name: "example-client",
          version: "1.0.0",
        },
      },
    };

    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(request),
    });

    // Extract session ID from response headers
    this.sessionId = response.headers.get("Mcp-Session-Id");

    const data: JsonRpcResponse = await response.json();
    console.log("Initialized:", data.result);
    console.log("Session ID:", this.sessionId);
  }

  async listTools(): Promise<any> {
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    };

    return this.sendRequest(request);
  }

  async searchNews(topic: string, options: any = {}): Promise<any> {
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "google_news_search",
        arguments: {
          topic,
          ...options,
        },
      },
    };

    return this.sendRequest(request);
  }

  async fetchPage(url: string, options: any = {}): Promise<any> {
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "fetch_page",
        arguments: {
          url,
          ...options,
        },
      },
    };

    return this.sendRequest(request);
  }

  private async sendRequest(request: JsonRpcRequest): Promise<any> {
    if (!this.sessionId) {
      throw new Error("Not initialized. Call initialize() first.");
    }

    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Mcp-Session-Id": this.sessionId,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: JsonRpcResponse = await response.json();

    if (data.error) {
      throw new Error(
        `JSON-RPC Error ${data.error.code}: ${data.error.message}`
      );
    }

    return data.result;
  }

  async openSSEStream(onMessage: (data: any) => void): Promise<void> {
    if (!this.sessionId) {
      throw new Error("Not initialized. Call initialize() first.");
    }

    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
        "Mcp-Session-Id": this.sessionId,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error("No response body");
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = JSON.parse(line.substring(6));
          onMessage(data);
        }
      }
    }
  }

  async terminateSession(): Promise<void> {
    if (!this.sessionId) return;

    await fetch(`${this.baseUrl}/mcp`, {
      method: "DELETE",
      headers: {
        "Mcp-Session-Id": this.sessionId,
      },
    });

    this.sessionId = null;
  }
}

// Example usage
async function main() {
  const client = new MCPHttpClient();

  try {
    // Initialize session
    console.log("=== Initializing ===");
    await client.initialize();

    // List available tools
    console.log("\n=== Listing Tools ===");
    const tools = await client.listTools();
    console.log(JSON.stringify(tools, null, 2));

    // Search for news
    console.log("\n=== Searching News ===");
    const searchResults = await client.searchNews("artificial intelligence", {
      num: 3,
      dateRestrict: "d7",
    });
    console.log(JSON.stringify(searchResults, null, 2));

    // Fetch a page (uncomment to test)
    // console.log("\n=== Fetching Page ===");
    // const pageContent = await client.fetchPage("https://example.com/article");
    // console.log(JSON.stringify(pageContent, null, 2));

    // Terminate session
    console.log("\n=== Terminating Session ===");
    await client.terminateSession();
    console.log("Session terminated");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { MCPHttpClient };
