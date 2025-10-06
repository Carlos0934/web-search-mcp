// src/errors.ts
import { MCPError, MCPErrorCode } from "./types.js";

export class MCPErrorException extends Error {
  public readonly code: MCPErrorCode;
  public readonly details?: Record<string, any>;

  constructor(
    code: MCPErrorCode,
    message: string,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = "MCPErrorException";
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
  }

  toMCPError(): MCPError {
    const result: MCPError = {
      code: this.code,
      message: this.message,
    };
    if (this.details !== undefined) {
      result.details = this.details;
    }
    return result;
  }
}

export function createMCPError(
  code: MCPErrorCode,
  message: string,
  details?: Record<string, any>
): MCPError {
  const result: MCPError = {
    code,
    message,
  };
  if (details !== undefined) {
    result.details = details;
  }
  return result;
}

export function handleGoogleCSEError(
  status: number,
  statusText: string
): MCPError {
  switch (status) {
    case 429:
      return createMCPError(
        "RATE_LIMITED",
        "Upstream rate limit from Google CSE.",
        {
          retryAfterMs: 4000,
          upstreamStatus: status,
        }
      );
    case 403:
      return createMCPError(
        "AUTH_FAILED",
        "Google CSE authentication failed. Check your API key and CX.",
        {
          upstreamStatus: status,
        }
      );
    case 400:
      return createMCPError(
        "INVALID_INPUT",
        "Invalid request parameters for Google CSE.",
        {
          upstreamStatus: status,
        }
      );
    default:
      return createMCPError(
        "UPSTREAM_ERROR",
        `Google CSE error: ${status} ${statusText}`,
        {
          upstreamStatus: status,
        }
      );
  }
}

export function handleFetchError(error: unknown, url: string): MCPError {
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return createMCPError("TIMEOUT", `Request timeout while fetching ${url}`);
    }
    if (
      error.message.includes("ENOTFOUND") ||
      error.message.includes("ECONNREFUSED")
    ) {
      return createMCPError(
        "NAVIGATION_BLOCKED",
        `Cannot reach ${url}: ${error.message}`
      );
    }
  }

  return createMCPError(
    "UPSTREAM_ERROR",
    `Fetch error for ${url}: ${String(error)}`
  );
}
