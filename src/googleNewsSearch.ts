// src/googleNewsSearch.ts
import {
  GoogleNewsSearchInput,
  NewsSearchResult,
  GoogleCSEResponse,
} from "./types.js";
import { Config } from "./config.js";
import { handleGoogleCSEError, createMCPError } from "./errors.js";
import {
  mapGoogleCSEItem,
  applyPrimaryFilters,
  dedupeByTitleDomain,
} from "./utils.js";

export class GoogleNewsSearchTool {
  constructor(private config: Config) {}

  async search(
    input: GoogleNewsSearchInput
  ): Promise<{ items: NewsSearchResult[] }> {
    const {
      topic,
      dateRestrict = this.config.env.NEWS_DEFAULT_DATE_RESTRICT,
      gl = this.config.env.NEWS_DEFAULT_GL,
      hl = this.config.env.NEWS_DEFAULT_HL,
      lr = this.config.env.NEWS_DEFAULT_LR,
      num = 8,
      primaryOnly = true,
    } = input;

    // Validate input
    if (!topic || topic.trim().length === 0) {
      throw createMCPError(
        "INVALID_INPUT",
        "Topic is required and cannot be empty"
      );
    }

    if (num < 1 || num > 10) {
      throw createMCPError(
        "INVALID_INPUT",
        "Number of results must be between 1 and 10"
      );
    }

    // Build Google CSE URL
    const url = new URL("https://www.googleapis.com/customsearch/v1");
    url.searchParams.set("key", this.config.env.GOOGLE_CSE_KEY);
    url.searchParams.set("cx", this.config.env.GOOGLE_CSE_CX);
    url.searchParams.set("q", topic);
    url.searchParams.set("num", String(Math.min(num, 10)));
    url.searchParams.set("gl", gl);
    url.searchParams.set("hl", hl);
    url.searchParams.set("lr", lr);
    url.searchParams.set("dateRestrict", dateRestrict);

    try {
      const response = await fetch(url.toString(), {
        headers: {
          "User-Agent": this.config.env.USER_AGENT,
        },
      });

      if (!response.ok) {
        throw handleGoogleCSEError(response.status, response.statusText);
      }

      const data: GoogleCSEResponse = await response.json();

      if (!data.items || data.items.length === 0) {
        return { items: [] };
      }

      // Map CSE items to our format
      let mapped = data.items.map(mapGoogleCSEItem);

      // Apply primary filters if requested
      if (primaryOnly) {
        mapped = applyPrimaryFilters(mapped, this.config.server);
      }

      // Deduplicate
      const deduped = dedupeByTitleDomain(mapped);

      // Return limited results
      return { items: deduped.slice(0, num) };
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error) {
        throw error; // Re-throw MCP errors
      }

      throw createMCPError(
        "UPSTREAM_ERROR",
        `Failed to search Google CSE: ${String(error)}`
      );
    }
  }
}
