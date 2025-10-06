// src/utils.ts
import { NewsSearchResult, GoogleCSEItem, ExtractedArticle } from "./types.js";
import { ServerConfig } from "./config.js";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { franc } from "franc";

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function isBlockedDomain(url: string, config: ServerConfig): boolean {
  const domain = extractDomain(url);

  // Check if domain is in allowlist (if allowlist is not empty)
  if (config.allowedDomains.length > 0) {
    return !config.allowedDomains.some(
      (allowed) => domain === allowed || domain.endsWith("." + allowed)
    );
  }

  // Check if domain is in blocklist
  return config.blockedDomains.some(
    (blocked) => domain === blocked || domain.endsWith("." + blocked)
  );
}

export function isOpinionContent(title: string, snippet: string): boolean {
  const opinionKeywords = [
    "opinion",
    "editorial",
    "commentary",
    "analysis",
    "perspective",
    "viewpoint",
    "think",
    "believe",
    "should",
    "must",
    "op-ed",
  ];

  const content = `${title} ${snippet}`.toLowerCase();
  return opinionKeywords.some((keyword) => content.includes(keyword));
}

export function mapGoogleCSEItem(item: GoogleCSEItem): NewsSearchResult {
  const signals = {
    hasNewsSchema: Boolean(item.pagemap?.newsarticle),
    hasPublishedTime: Boolean(
      item.pagemap?.metatags?.[0]?.["article:published_time"]
    ),
    opinionLikely: isOpinionContent(item.title, item.snippet),
    blockedReason: null as string | null,
  };

  return {
    title: item.title,
    snippet: item.snippet,
    url: item.link,
    source: item.displayLink,
    date: item.pagemap?.metatags?.[0]?.["article:published_time"] || null,
    lang:
      (item.pagemap?.metatags?.[0]?.["og:locale"] || "").slice(0, 2) || null,
    signals,
  };
}

export function applyPrimaryFilters(
  items: NewsSearchResult[],
  config: ServerConfig
): NewsSearchResult[] {
  return items.filter((item) => {
    // Check blocked domains
    if (isBlockedDomain(item.url, config)) {
      item.signals.blockedReason = "blocked_domain";
      return false;
    }

    // Check opinion content (if not allowed)
    if (!config.allowOpinion && item.signals.opinionLikely) {
      item.signals.blockedReason = "opinion_content";
      return false;
    }

    // Prefer items with news metadata
    const hasGoodMetadata =
      item.signals.hasNewsSchema || item.signals.hasPublishedTime;

    // Filter out obvious non-articles
    const title = item.title.toLowerCase();
    const isNonArticle = [
      "podcast",
      "video",
      "watch",
      "listen",
      "homepage",
      "index",
      "directory",
      "app store",
      "download",
    ].some((keyword) => title.includes(keyword));

    if (isNonArticle) {
      item.signals.blockedReason = "non_article";
      return false;
    }

    return hasGoodMetadata || item.date !== null;
  });
}

export function dedupeByTitleDomain(
  items: NewsSearchResult[]
): NewsSearchResult[] {
  const seen = new Map<string, NewsSearchResult>();

  for (const item of items) {
    const key = `${normalizeTitle(item.title)}_${extractDomain(item.url)}`;
    const existing = seen.get(key);

    if (!existing) {
      seen.set(key, item);
    } else {
      // Keep the one with better metadata
      const itemScore =
        (item.signals.hasNewsSchema ? 2 : 0) +
        (item.signals.hasPublishedTime ? 1 : 0);
      const existingScore =
        (existing.signals.hasNewsSchema ? 2 : 0) +
        (existing.signals.hasPublishedTime ? 1 : 0);

      if (itemScore > existingScore) {
        seen.set(key, item);
      }
    }
  }

  return Array.from(seen.values());
}

export function extractArticleContent(html: string): ExtractedArticle {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  let title: string | null = null;
  let description: string | null = null;
  let published_at: string | null = null;
  let byline: string | null = null;
  let text: string | null = null;
  let word_count: number | null = null;
  let lang_detected: string | null = null;
  const flags: string[] = [];

  try {
    // Extract metadata
    title = extractTitle(document);
    description = extractDescription(document);
    published_at = extractPublishedDate(document);
    byline = extractByline(document);

    // Extract article text using Readability
    const reader = new Readability(document);
    const article = reader.parse();

    if (article) {
      text = article.textContent;
      word_count = text ? text.split(/\s+/).length : 0;

      // Detect language
      if (text && text.length > 50) {
        const detected = franc(text);
        lang_detected = detected !== "und" ? detected : null;
      }
    }

    // Set quality flags
    if (!text || text.length < 120) {
      flags.push("short_text");
    }

    if (!published_at) {
      flags.push("no_date");
    }

    if (isPaywalled(document, text)) {
      flags.push("paywalled");
    }

    if (isOpinionContent(title || "", description || "")) {
      flags.push("opinion");
    }
  } catch (error) {
    console.error("Error extracting article content:", error);
    flags.push("extraction_error");
  }

  return {
    title,
    description,
    published_at,
    byline,
    text,
    word_count,
    lang_detected,
    flags,
  };
}

function extractTitle(document: Document): string | null {
  // Try different selectors for title
  const selectors = [
    'meta[property="og:title"]',
    'meta[name="twitter:title"]',
    "h1",
    "title",
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      const content = element.getAttribute("content") || element.textContent;
      if (content && content.trim()) {
        return content.trim();
      }
    }
  }

  return null;
}

function extractDescription(document: Document): string | null {
  const selectors = [
    'meta[property="og:description"]',
    'meta[name="description"]',
    'meta[name="twitter:description"]',
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      const content = element.getAttribute("content");
      if (content && content.trim()) {
        return content.trim();
      }
    }
  }

  return null;
}

function extractPublishedDate(document: Document): string | null {
  // Try JSON-LD first
  const scripts = document.querySelectorAll(
    'script[type="application/ld+json"]'
  );
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent || "");
      const articles = Array.isArray(data) ? data : [data];

      for (const article of articles) {
        if (
          article["@type"] === "NewsArticle" ||
          article["@type"] === "Article"
        ) {
          if (article.datePublished) {
            return new Date(article.datePublished).toISOString();
          }
        }
      }
    } catch {
      // Ignore JSON parse errors
    }
  }

  // Try meta tags
  const selectors = [
    'meta[property="article:published_time"]',
    'meta[name="pubdate"]',
    'meta[name="publishdate"]',
    "time[datetime]",
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      const content =
        element.getAttribute("content") || element.getAttribute("datetime");
      if (content) {
        try {
          return new Date(content).toISOString();
        } catch {
          // Invalid date format
        }
      }
    }
  }

  return null;
}

function extractByline(document: Document): string | null {
  const selectors = [
    'meta[name="author"]',
    'meta[property="article:author"]',
    ".byline",
    ".author",
    '[rel="author"]',
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      const content = element.getAttribute("content") || element.textContent;
      if (content && content.trim()) {
        return content.trim();
      }
    }
  }

  return null;
}

function isPaywalled(document: Document, text: string | null): boolean {
  // Check for common paywall indicators
  const paywallSelectors = [
    ".paywall",
    ".subscription-required",
    ".premium-content",
    "[data-paywall]",
  ];

  for (const selector of paywallSelectors) {
    if (document.querySelector(selector)) {
      return true;
    }
  }

  // Check for paywall keywords in text
  if (text) {
    const paywallKeywords = [
      "subscribe to continue",
      "subscription required",
      "premium content",
      "paywall",
      "become a member",
    ];

    const lowerText = text.toLowerCase();
    if (paywallKeywords.some((keyword) => lowerText.includes(keyword))) {
      return true;
    }
  }

  // Check if text is suspiciously short (potential paywall truncation)
  return text !== null && text.length < 120;
}
