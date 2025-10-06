// src/types.ts

export interface NewsSearchResult {
  title: string;
  snippet: string;
  url: string;
  source: string;
  date: string | null;
  lang: string | null;
  signals: {
    hasNewsSchema: boolean;
    hasPublishedTime: boolean;
    opinionLikely: boolean;
    blockedReason: string | null;
  };
}

export interface GoogleCSEItem {
  title: string;
  snippet: string;
  link: string;
  displayLink: string;
  pagemap?: {
    metatags?: Array<{
      "article:published_time"?: string;
      "og:locale"?: string;
      [key: string]: string | undefined;
    }>;
    newsarticle?: Array<{
      [key: string]: any;
    }>;
    [key: string]: any;
  };
}

export interface GoogleCSEResponse {
  items?: GoogleCSEItem[];
  searchInformation?: {
    totalResults: string;
    searchTime: number;
  };
}

export interface FetchPageResult {
  url: string;
  finalUrl: string;
  source: string;
  title: string | null;
  description: string | null;
  published_at: string | null;
  byline: string | null;
  text: string | null;
  word_count: number | null;
  lang_detected: string | null;
  paywalled: boolean;
  quality_flags: string[];
}

export interface ExtractedArticle {
  title: string | null;
  description: string | null;
  published_at: string | null;
  byline: string | null;
  text: string | null;
  word_count: number | null;
  lang_detected: string | null;
  flags: string[];
}

export interface MCPError {
  code: string;
  message: string;
  details?: {
    retryAfterMs?: number;
    upstreamStatus?: number;
    [key: string]: any;
  };
}

export type MCPErrorCode =
  | "RATE_LIMITED"
  | "AUTH_FAILED"
  | "NO_RESULTS"
  | "INVALID_INPUT"
  | "UPSTREAM_ERROR"
  | "TIMEOUT"
  | "PAYWALLED"
  | "NAVIGATION_BLOCKED"
  | "UNSUPPORTED_MIME";

export interface GoogleNewsSearchInput {
  topic: string;
  dateRestrict?: string;
  gl?: string;
  hl?: string;
  lr?: string;
  num?: number;
  primaryOnly?: boolean;
}

export interface FetchPageInput {
  url: string;
  timeoutMs?: number;
  maxChars?: number;
  language?: string;
}
