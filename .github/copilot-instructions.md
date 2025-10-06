# AI Coding Agent Instructions for web-search-mcp

## Project Overview

This is an **MCP (Model Context Protocol) server** implementing **Streamable HTTP transport** (protocol version 2024-11-05) for web search via Google Custom Search Engine (CSE) and article content extraction. The server exposes two MCP tools: `google_news_search` and `fetch_page`.

## Architecture

### Core Components

- **`src/httpServer.ts`**: Main HTTP server implementing MCP Streamable HTTP protocol
  - Session management with UUID-based session IDs
  - JSON-RPC 2.0 over HTTP POST
  - Server-Sent Events (SSE) for streaming responses
  - Supports multiple concurrent SSE streams per session
- **`src/server.ts`**: Minimal entry point that creates `MCPHttpServer` and handles process-level errors
- **`src/googleNewsSearch.ts`**: Google CSE integration with filtering, deduplication, and quality scoring
- **`src/fetchPage.ts`**: Article fetching using Mozilla Readability for content extraction
- **`src/config.ts`**: Configuration loader for `mcp.config.json` and environment variables
- **`src/errors.ts`**: MCP-compliant error handling with specific error codes (RATE_LIMITED, AUTH_FAILED, etc.)
- **`src/utils.ts`**: Article filtering logic, primary article selection, and deduplication
- **`src/rateLimit.ts`**: Rate limiting and exponential backoff mechanisms

### Key Architectural Patterns

1. **Session-based authentication**: Every request after `initialize` requires `Mcp-Session-Id` header
2. **Content negotiation**: Responses are JSON or SSE based on `Accept` header
3. **Primary article filtering**: Applies quality scoring based on NewsArticle schema, domain reputation, and metadata
4. **Deduplication**: Normalizes titles and removes duplicates by domain
5. **Security-first**: Defaults to `127.0.0.1` binding, validates Origin header, non-root Docker user

## Development Workflows

### Local Development

```bash
pnpm install           # Install dependencies
pnpm run dev           # Start with tsx watch (auto-reload)
pnpm run build         # TypeScript compilation
pnpm start             # Run built code
```

### Testing the Server

```bash
# 1. Initialize session (get Mcp-Session-Id from response header)
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' \
  -i

# 2. Use the session (replace <SESSION_ID>)
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: <SESSION_ID>" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"google_news_search","arguments":{"topic":"AI","num":3}}}'
```

### Docker Deployment

```bash
docker build -t web-search-mcp .
docker run -p 3000:3000 --env-file .env web-search-mcp

# Or use docker-compose
docker-compose up -d
```

**Important**: For Docker, set `host: "0.0.0.0"` in `mcp.config.json` (not `127.0.0.1`)

## Configuration Patterns

### Environment Variables (Required)

- `GOOGLE_CSE_KEY`: Google Custom Search API key
- `GOOGLE_CSE_CX`: Custom Search Engine ID
- Optional: `NEWS_DEFAULT_GL`, `NEWS_DEFAULT_HL`, `FETCH_TIMEOUT_MS`, `USER_AGENT`

### mcp.config.json Structure

```json
{
  "transport": "http",        // Always "http" for this implementation
  "port": 3000,
  "host": "127.0.0.1",       // Use "0.0.0.0" for Docker
  "rateLimit": {
    "windowMs": 60000,
    "max": 120
  },
  "allowOpinion": false,     // Filter opinion pieces
  "blockedDomains": [...]    // Social media, podcasts, paywalled sites
}
```

## Project-Specific Conventions

### Error Handling

- Always throw `MCPErrorException` or use `createMCPError()` for tool errors
- Error codes: `RATE_LIMITED`, `AUTH_FAILED`, `NO_RESULTS`, `INVALID_INPUT`, `UPSTREAM_ERROR`, `TIMEOUT`, `PAYWALLED`, `NAVIGATION_BLOCKED`, `UNSUPPORTED_MIME`
- HTTP server catches these and converts to JSON-RPC error responses

### MCP Protocol Compliance

- **Requests**: Return JSON-RPC response or SSE stream (based on `Accept` header)
- **Notifications**: Return `202 Accepted` with no body
- **SSE streams**: Use event IDs for resumability via `Last-Event-ID` header
- **Session lifecycle**: Create on `initialize`, validate on every request, cleanup after 1 hour timeout

### Content Filtering Logic

- **Primary articles**: Prefer articles with NewsArticle schema, published date, and non-opinion content
- **Blocked domains**: Excludes social media, podcasts, video platforms (see `mcp.config.json`)
- **Deduplication**: Normalizes titles (removes special chars, lowercase) and groups by domain

## Common Operations

### Adding a New MCP Tool

1. Add tool definition in `handleToolsList()` in `src/httpServer.ts`
2. Add case in `handleToolCall()` to route to tool implementation
3. Create tool class in `src/` (follow pattern of `GoogleNewsSearchTool`)
4. Add input types to `src/types.ts`

### Modifying Rate Limits

Edit `mcp.config.json` → `rateLimit.windowMs` and `rateLimit.max`

### Adding Domain Filters

Edit `mcp.config.json` → `blockedDomains` or `allowedDomains`

## CI/CD Integration

- **GitHub Actions workflows**: CI (lint/test), Docker publish (ghcr.io), Release (semantic versioning)
- **Image tags**: `latest`, `main`, `develop`, `v1.0.0`, `v1.0`, `v1`
- **Multi-platform builds**: linux/amd64, linux/arm64
- **Security scanning**: Trivy vulnerability scanner
- See `CI_CD.md` for complete documentation

## Security Notes

- **Never commit** `.env` file with API keys
- **Origin validation**: Currently allows all origins (TODO: implement strict validation)
- **Docker security**: Non-root user, minimal Alpine image, health checks
- **Production**: Use HTTPS, implement authentication, restrict origins

## Key Files Reference

- **HTTP API spec**: `HTTP_API.md` (complete protocol documentation)
- **Implementation summary**: `IMPLEMENTATION_SUMMARY.md` (HTTP transport migration details)
- **Docker optimization**: `DOCKER_OPTIMIZATION.md`
- **CI/CD guide**: `CI_CD.md`
- **Example client**: `examples/http-client-example.ts`

## Dependencies

- **@modelcontextprotocol/sdk**: MCP protocol implementation
- **jsdom + @mozilla/readability**: Article content extraction
- **franc**: Language detection
- **date-fns**: Date manipulation
- **Node.js**: >=22.0.0 required
- **pnpm**: 9.12.3 (package manager)

## Common Issues

1. **Docker networking**: If server won't accept connections in Docker, verify `host: "0.0.0.0"` in config
2. **Session not found**: Sessions expire after 1 hour; clients must re-initialize
3. **Rate limit errors**: Adjust `rateLimit.max` in config or implement per-client limits
4. **Missing GOOGLE_CSE_KEY**: Server won't start without required env vars; check `.env` file
