# MCP Streamable HTTP API Documentation

This server implements the Model Context Protocol (MCP) Streamable HTTP transport as specified in protocol version 2024-11-05.

## Base URL

```
http://localhost:3000
```

For production deployments, use appropriate domain and HTTPS.

## Security Considerations

⚠️ **Important Security Notes:**

1. **Origin Validation**: The server validates the `Origin` header to prevent DNS rebinding attacks
2. **Local Binding**: By default, the server binds to `127.0.0.1` (localhost only) for security
3. **Authentication**: Implement proper authentication for production use
4. **HTTPS**: Always use HTTPS in production environments

## Endpoints

### Health Check

**GET** `/health`

Returns server health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-10-06T12:00:00.000Z",
  "sessions": 3
}
```

### MCP Endpoint

**URL**: `/mcp` or `/`

This is the main MCP endpoint supporting POST, GET, and DELETE methods.

## Session Management

### Creating a Session

Sessions are created automatically during the initialization phase.

**Request:**
```http
POST /mcp HTTP/1.1
Content-Type: application/json
Accept: application/json, text/event-stream

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {
      "name": "example-client",
      "version": "1.0.0"
    }
  }
}
```

**Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json
Mcp-Session-Id: 550e8400-e29b-41d4-a716-446655440000

{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": {}
    },
    "serverInfo": {
      "name": "news-tools",
      "version": "1.0.0"
    }
  }
}
```

### Using a Session

Include the `Mcp-Session-Id` header in all subsequent requests:

```http
POST /mcp HTTP/1.1
Content-Type: application/json
Accept: application/json, text/event-stream
Mcp-Session-Id: 550e8400-e29b-41d4-a716-446655440000

{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list",
  "params": {}
}
```

### Terminating a Session

**Request:**
```http
DELETE /mcp HTTP/1.1
Mcp-Session-Id: 550e8400-e29b-41d4-a716-446655440000
```

**Response:**
```http
HTTP/1.1 200 OK
```

## Sending JSON-RPC Messages (POST)

### Basic JSON Response

**Request:**
```http
POST /mcp HTTP/1.1
Content-Type: application/json
Accept: application/json
Mcp-Session-Id: <session-id>

{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/list",
  "params": {}
}
```

**Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "tools": [...]
  }
}
```

### Server-Sent Events (SSE) Response

When the client includes `text/event-stream` in the Accept header, the server may respond with an SSE stream:

**Request:**
```http
POST /mcp HTTP/1.1
Content-Type: application/json
Accept: application/json, text/event-stream
Mcp-Session-Id: <session-id>

{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "google_news_search",
    "arguments": {
      "topic": "artificial intelligence",
      "num": 5
    }
  }
}
```

**Response:**
```http
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

id: 1
data: {"jsonrpc":"2.0","id":4,"result":{"content":[...]}}

```

### Notifications (No Response Expected)

For JSON-RPC notifications (requests without an `id` field):

**Request:**
```http
POST /mcp HTTP/1.1
Content-Type: application/json
Mcp-Session-Id: <session-id>

{
  "jsonrpc": "2.0",
  "method": "notifications/cancelled",
  "params": {
    "requestId": 4
  }
}
```

**Response:**
```http
HTTP/1.1 202 Accepted
```

## Listening for Server Messages (GET)

Clients can open an SSE stream to receive server-initiated messages:

**Request:**
```http
GET /mcp HTTP/1.1
Accept: text/event-stream
Mcp-Session-Id: <session-id>
```

**Response:**
```http
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

: keepalive

id: 5
data: {"jsonrpc":"2.0","method":"notifications/progress","params":{...}}

```

### Resuming Disconnected Streams

To resume a broken connection and replay missed messages:

**Request:**
```http
GET /mcp HTTP/1.1
Accept: text/event-stream
Mcp-Session-Id: <session-id>
Last-Event-ID: 5
```

The server will replay messages with event IDs greater than 5.

## Available Tools

### 1. Google News Search

Search for recent news articles using Google Custom Search Engine.

**Method:** `tools/call`

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "google_news_search",
    "arguments": {
      "topic": "artificial intelligence",
      "dateRestrict": "w1",
      "gl": "us",
      "hl": "en",
      "lr": "lang_en",
      "num": 5,
      "primaryOnly": true
    }
  }
}
```

**Parameters:**
- `topic` (string, required): Search topic
- `dateRestrict` (string, optional): Freshness window - `d1`, `d3`, `w1`, `m1`. Default: `d3`
- `gl` (string, optional): Country bias (e.g., `us`, `gb`, `ca`). Default: `us`
- `hl` (string, optional): UI language. Default: `en`
- `lr` (string, optional): Document language filter. Default: `lang_en`
- `num` (integer, optional): Max results (1-10). Default: `8`
- `primaryOnly` (boolean, optional): Filter to primary articles only. Default: `true`

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"items\":[{\"title\":\"...\",\"snippet\":\"...\",\"url\":\"...\",\"source\":\"...\",\"date\":\"...\",\"lang\":\"...\",\"signals\":{...}}]}"
      }
    ]
  }
}
```

### 2. Fetch Page

Fetch and extract article content from a URL.

**Method:** `tools/call`

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "fetch_page",
    "arguments": {
      "url": "https://example.com/article",
      "timeoutMs": 10000,
      "maxChars": 10000,
      "language": "en"
    }
  }
}
```

**Parameters:**
- `url` (string, required): URL to fetch
- `timeoutMs` (integer, optional): Request timeout in milliseconds. Default: `12000`
- `maxChars` (integer, optional): Maximum content length. Default: `12000`
- `language` (string, optional): Expected language (ISO 639-1). Default: `en`

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"url\":\"...\",\"finalUrl\":\"...\",\"source\":\"...\",\"title\":\"...\",\"description\":\"...\",\"published_at\":\"...\",\"byline\":\"...\",\"text\":\"...\",\"word_count\":456,\"lang_detected\":\"en\",\"paywalled\":false,\"quality_flags\":[]}"
      }
    ]
  }
}
```

## Error Responses

### Session Not Found

```http
HTTP/1.1 404 Not Found
Content-Type: application/json

{
  "error": "Session not found"
}
```

### Invalid Request

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "error": {
    "code": -32700,
    "message": "Parse error",
    "data": "..."
  }
}
```

### Method Not Found

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32601,
    "message": "Method not found: unknown_method"
  }
}
```

### Rate Limited

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32603,
    "message": "Rate limit exceeded",
    "data": {
      "retryAfterMs": 4000,
      "maxRequests": 120,
      "windowMs": 60000
    }
  }
}
```

## CORS Headers

The server includes the following CORS headers:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Accept, Mcp-Session-Id, Last-Event-ID
Access-Control-Expose-Headers: Mcp-Session-Id
```

## Testing with cURL

### Initialize Session
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "curl-client", "version": "1.0.0"}
    }
  }' -i
```

### List Tools
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Mcp-Session-Id: <session-id>" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }'
```

### Search News
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Mcp-Session-Id: <session-id>" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "google_news_search",
      "arguments": {
        "topic": "technology",
        "num": 3
      }
    }
  }'
```

### Open SSE Stream
```bash
curl -N http://localhost:3000/mcp \
  -H "Accept: text/event-stream" \
  -H "Mcp-Session-Id: <session-id>"
```