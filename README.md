# Web Search MCP Server

[![CI](https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/ci.yml)
[![Docker Publish](https://github.com/OWNER/REPO/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/docker-publish.yml)
[![Release](https://github.com/OWNER/REPO/actions/workflows/release.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/release.yml)

A Model Context Protocol (MCP) server implementing Streamable HTTP transport for web search capabilities using Google Custom Search Engine (CSE) and article content extraction.

## Features

- **MCP Streamable HTTP Transport**: Implements MCP protocol version 2024-11-05 with HTTP POST/GET and SSE support
- **Session Management**: Stateful sessions with automatic cleanup and resumable SSE streams
- **Google News Search**: Search recent news articles using Google CSE with filtering and deduplication
- **Article Fetching**: Extract and clean article content from URLs
- **Content Filtering**: Primary article selection with quality scoring
- **Rate Limiting**: Built-in rate limiting and backoff mechanisms
- **Security**: Origin validation, localhost-first binding, session-based authentication
- **Error Handling**: Comprehensive error handling with MCP-compliant responses

## Installation

### Using Docker (Recommended)

Pull the latest image from GitHub Container Registry:

```bash
docker pull ghcr.io/OWNER/REPO:latest
```

Or use Docker Compose:

```bash
# Create .env file with your credentials
cp .env.example .env
# Edit .env with your Google CSE credentials

# Start the service
docker-compose up -d
```

### From Source

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables (see Configuration section)

4. Build the project:
   ```bash
   npm run build
   ```

## Configuration

### Environment Variables

Create a `.env` file with the following variables:

```env
# Required
GOOGLE_CSE_KEY=your_google_cse_api_key
GOOGLE_CSE_CX=your_custom_search_engine_id

# Optional (with defaults)
NEWS_DEFAULT_GL=us
NEWS_DEFAULT_HL=en
NEWS_DEFAULT_LR=lang_en
NEWS_DEFAULT_DATE_RESTRICT=d3
FETCH_TIMEOUT_MS=12000
FETCH_MAX_CHARS=12000
USER_AGENT=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36
```

### Server Configuration

The server uses `mcp.config.json` for configuration:

```json
{
  "transport": "http",
  "port": 3000,
  "host": "127.0.0.1",
  "logLevel": "info",
  "rateLimit": {
    "windowMs": 60000,
    "max": 120
  },
  "allowOpinion": false,
  "blockedDomains": [...]
}
```

**Security Note**: By default, the server binds to `127.0.0.1` (localhost only). For Docker deployments, use `0.0.0.0` but ensure proper firewall and authentication measures.

## API Documentation

The server implements MCP Streamable HTTP transport. See [HTTP_API.md](./HTTP_API.md) for complete API documentation including:

- Session management
- JSON-RPC over HTTP POST
- Server-Sent Events (SSE) streaming
- Resumable connections
- cURL examples

## Tools

### google_news_search

Search recent news via Google CSE with intelligent filtering.

**Parameters:**
- `topic` (required): Search topic
- `dateRestrict`: Freshness window (d1, d3, w1, m1)
- `gl`: Country bias (us, gb, ca, etc.)
- `hl`: UI language
- `lr`: Document language filter
- `num`: Max results (1-10)
- `primaryOnly`: Filter to primary articles only

### fetch_page

Fetch and extract article content from URLs.

**Parameters:**
- `url` (required): URL to fetch
- `timeoutMs`: Request timeout
- `maxChars`: Maximum content length
- `language`: Expected language

## Usage

### Development

```bash
npm run dev
```

The server will start on `http://127.0.0.1:3000`.

### Production

```bash
npm run build
npm start
```

### Docker

Build and run with Docker:

```bash
# Build the image
docker build -t web-search-mcp .

# Run with environment variables
docker run -p 3000:3000 \
  -e GOOGLE_CSE_KEY=your_key \
  -e GOOGLE_CSE_CX=your_cx \
  web-search-mcp
```

Or use Docker Compose:

```bash
# Create .env file with your credentials
cp .env.example .env
# Edit .env with your values

# Start the service
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the service
docker-compose down
```

### Quick Test

```bash
# Initialize session
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' \
  -i

# Use the Mcp-Session-Id from the response above
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: <session-id>" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"google_news_search","arguments":{"topic":"AI","num":3}}}'
```

## Architecture

- **MCP Streamable HTTP**: Full implementation of MCP protocol 2024-11-05 with HTTP POST/GET and SSE
- **Session Management**: Cryptographically secure session IDs with automatic expiration
- **Primary Article Filtering**: Applies quality scoring based on metadata, domain reputation, and content type
- **Deduplication**: Removes duplicate articles by normalized title and domain
- **Content Extraction**: Uses Mozilla Readability for clean article text extraction
- **Language Detection**: Automatic language detection with franc
- **Paywall Detection**: Identifies paywalled content
- **SSE Streaming**: Support for Server-Sent Events with resumable connections
- **Origin Validation**: DNS rebinding attack protection

## CI/CD & Deployment

This project uses GitHub Actions for continuous integration and deployment. Docker images are automatically built and published to GitHub Container Registry.

**Automated workflows:**
- ✅ Continuous Integration (lint, test, build)
- ✅ Docker image publishing (multi-platform: amd64, arm64)
- ✅ Automated releases with semantic versioning
- ✅ Security scanning with Trivy
- ✅ Dependency updates with Dependabot

**Available Docker tags:**
```bash
ghcr.io/OWNER/REPO:latest      # Latest stable release
ghcr.io/OWNER/REPO:v1.0.0      # Specific version
ghcr.io/OWNER/REPO:v1.0        # Minor version
ghcr.io/OWNER/REPO:main        # Latest main branch
```

See [CI_CD.md](./CI_CD.md) for complete CI/CD documentation.

## Error Handling

The server returns MCP-compliant errors with specific error codes:

- `RATE_LIMITED`: Rate limit exceeded
- `AUTH_FAILED`: Authentication failure
- `NO_RESULTS`: No results found
- `INVALID_INPUT`: Invalid request parameters
- `UPSTREAM_ERROR`: External service error
- `TIMEOUT`: Request timeout
- `PAYWALLED`: Content behind paywall
- `NAVIGATION_BLOCKED`: Cannot access URL
- `UNSUPPORTED_MIME`: Unsupported content type

## License

MIT