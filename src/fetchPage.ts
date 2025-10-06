// src/fetchPage.ts
import { FetchPageInput, FetchPageResult } from "./types.js";
import { Config } from "./config.js";
import { handleFetchError, createMCPError } from "./errors.js";
import { extractArticleContent, extractDomain } from "./utils.js";

export class FetchPageTool {
  constructor(private config: Config) {}

  async fetchPage(input: FetchPageInput): Promise<FetchPageResult> {
    const {
      url,
      timeoutMs = this.config.env.FETCH_TIMEOUT_MS,
      maxChars = this.config.env.FETCH_MAX_CHARS,
      language = "en",
    } = input;

    // Validate input
    try {
      new URL(url); // This will throw if URL is invalid
    } catch {
      throw createMCPError("INVALID_INPUT", "Invalid URL provided");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        redirect: "follow",
        headers: {
          "User-Agent": this.config.env.USER_AGENT,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": `${language},en;q=0.5`,
          "Accept-Encoding": "gzip, deflate",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const finalUrl = response.url;
      const source = extractDomain(finalUrl);

      if (!response.ok) {
        throw createMCPError(
          "UPSTREAM_ERROR",
          `HTTP ${response.status}: ${response.statusText}`
        );
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/html")) {
        throw createMCPError(
          "UNSUPPORTED_MIME",
          `Unsupported content type: ${contentType}`
        );
      }

      const html = await response.text();

      if (html.length === 0) {
        throw createMCPError("UPSTREAM_ERROR", "Empty response received");
      }

      // Extract article content
      const extracted = extractArticleContent(html);

      // Truncate text if necessary
      let text = extracted.text;
      if (text && text.length > maxChars) {
        text = text.substring(0, maxChars);
        extracted.flags.push("truncated");
      }

      // Check for paywalls
      const paywalled = extracted.flags.includes("paywalled");

      // Language validation
      if (
        extracted.lang_detected &&
        extracted.lang_detected !== language &&
        language !== "en"
      ) {
        extracted.flags.push("language_mismatch");
      }

      return {
        url,
        finalUrl,
        source,
        title: extracted.title,
        description: extracted.description,
        published_at: extracted.published_at,
        byline: extracted.byline,
        text,
        word_count: extracted.word_count,
        lang_detected: extracted.lang_detected,
        paywalled,
        quality_flags: extracted.flags,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (typeof error === "object" && error !== null && "code" in error) {
        throw error; // Re-throw MCP errors
      }

      throw handleFetchError(error, url);
    }
  }
}
