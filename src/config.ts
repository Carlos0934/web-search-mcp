// src/config.ts
import { readFileSync } from "fs";
import { join } from "path";

export interface ServerConfig {
  transport: "stdio" | "websocket" | "http";
  logLevel: "debug" | "info" | "warn" | "error";
  port?: number;
  host?: string;
  rateLimit: {
    windowMs: number;
    max: number;
  };
  dedupe: {
    normalizeTitles: boolean;
    windowMinutes: number;
  };
  allowOpinion: boolean;
  allowedDomains: string[];
  blockedDomains: string[];
}

export interface EnvironmentConfig {
  GOOGLE_CSE_KEY: string;
  GOOGLE_CSE_CX: string;
  NEWS_DEFAULT_GL: string;
  NEWS_DEFAULT_HL: string;
  NEWS_DEFAULT_LR: string;
  NEWS_DEFAULT_DATE_RESTRICT: string;
  FETCH_TIMEOUT_MS: number;
  FETCH_MAX_CHARS: number;
  USER_AGENT: string;
}

export class Config {
  public readonly server: ServerConfig;
  public readonly env: EnvironmentConfig;

  constructor() {
    this.server = this.loadServerConfig();
    this.env = this.loadEnvironmentConfig();
  }

  private loadServerConfig(): ServerConfig {
    try {
      const configPath = join(process.cwd(), "mcp.config.json");
      const configData = readFileSync(configPath, "utf-8");
      return JSON.parse(configData);
    } catch (error) {
      console.warn("Could not load server config, using defaults");
      return {
        transport: "http",
        logLevel: "info",
        port: 3000,
        host: "0.0.0.0",
        rateLimit: { windowMs: 60000, max: 120 },
        dedupe: { normalizeTitles: true, windowMinutes: 60 },
        allowOpinion: false,
        allowedDomains: [],
        blockedDomains: [
          "podcasts.apple.com",
          "open.spotify.com",
          "youtube.com",
          "youtu.be",
          "soundcloud.com",
          "reddit.com",
          "medium.com",
          "substack.com",
          "facebook.com",
          "x.com",
          "twitter.com",
          "tiktok.com",
          "linktr.ee",
        ],
      };
    }
  }

  private loadEnvironmentConfig(): EnvironmentConfig {
    const required = ["GOOGLE_CSE_KEY", "GOOGLE_CSE_CX"];
    const missing = required.filter((key) => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(", ")}`
      );
    }

    return {
      GOOGLE_CSE_KEY: process.env.GOOGLE_CSE_KEY!,
      GOOGLE_CSE_CX: process.env.GOOGLE_CSE_CX!,
      NEWS_DEFAULT_GL: process.env.NEWS_DEFAULT_GL || "us",
      NEWS_DEFAULT_HL: process.env.NEWS_DEFAULT_HL || "en",
      NEWS_DEFAULT_LR: process.env.NEWS_DEFAULT_LR || "lang_en",
      NEWS_DEFAULT_DATE_RESTRICT:
        process.env.NEWS_DEFAULT_DATE_RESTRICT || "d3",
      FETCH_TIMEOUT_MS: parseInt(process.env.FETCH_TIMEOUT_MS || "12000", 10),
      FETCH_MAX_CHARS: parseInt(process.env.FETCH_MAX_CHARS || "12000", 10),
      USER_AGENT:
        process.env.USER_AGENT ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    };
  }
}
