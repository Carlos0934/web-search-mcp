// examples/example-usage.ts
// This is an example of how to use the MCP server tools

// Example Google News Search request
const searchRequest = {
  tool_name: "google_news_search",
  arguments: {
    topic: "artificial intelligence breakthrough",
    dateRestrict: "w1",
    gl: "us",
    num: 5,
    primaryOnly: true,
  },
};

// Example Fetch Page request
const fetchRequest = {
  tool_name: "fetch_page",
  arguments: {
    url: "https://www.reuters.com/technology/artificial-intelligence/",
    timeoutMs: 10000,
    maxChars: 10000,
    language: "en",
  },
};

// Example responses:

// Google News Search Response:
const searchResponse = {
  items: [
    {
      title: "Major AI Breakthrough in Natural Language Processing",
      snippet: "Researchers announce significant progress...",
      url: "https://www.reuters.com/technology/ai-breakthrough-2024/",
      source: "reuters.com",
      date: "2024-10-05T12:34:56Z",
      lang: "en",
      signals: {
        hasNewsSchema: true,
        hasPublishedTime: true,
        opinionLikely: false,
        blockedReason: null,
      },
    },
  ],
};

// Fetch Page Response:
const fetchResponse = {
  url: "https://www.reuters.com/technology/artificial-intelligence/",
  finalUrl: "https://www.reuters.com/technology/artificial-intelligence/",
  source: "reuters.com",
  title: "Artificial Intelligence News",
  description: "Latest news and developments in AI technology",
  published_at: "2024-10-05T12:34:56Z",
  byline: "Reuters Technology Team",
  text: "Article content goes here...",
  word_count: 456,
  lang_detected: "en",
  paywalled: false,
  quality_flags: [],
};
