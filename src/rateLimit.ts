// src/rateLimit.ts
import { createMCPError } from "./errors.js";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export class RateLimiter {
  private readonly limits = new Map<string, RateLimitEntry>();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number, maxRequests: number) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;

    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  async checkLimit(clientId: string): Promise<void> {
    const now = Date.now();
    const resetTime = now + this.windowMs;

    let entry = this.limits.get(clientId);

    if (!entry || now >= entry.resetTime) {
      // Reset or create new entry
      entry = { count: 0, resetTime };
      this.limits.set(clientId, entry);
    }

    if (entry.count >= this.maxRequests) {
      const retryAfterMs = entry.resetTime - now;
      throw createMCPError("RATE_LIMITED", "Rate limit exceeded", {
        retryAfterMs,
        maxRequests: this.maxRequests,
        windowMs: this.windowMs,
      });
    }

    entry.count++;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [clientId, entry] of this.limits.entries()) {
      if (now >= entry.resetTime) {
        this.limits.delete(clientId);
      }
    }
  }

  reset(clientId?: string): void {
    if (clientId) {
      this.limits.delete(clientId);
    } else {
      this.limits.clear();
    }
  }
}

export class BackoffManager {
  private readonly delays = new Map<string, number>();
  private readonly maxDelay = 32000; // 32 seconds
  private readonly baseDelay = 1000; // 1 second

  async withBackoff<T>(key: string, operation: () => Promise<T>): Promise<T> {
    try {
      const result = await operation();
      // Success - reset delay
      this.delays.delete(key);
      return result;
    } catch (error) {
      // Check if this is a rate limit error
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "RATE_LIMITED"
      ) {
        const currentDelay = this.delays.get(key) || this.baseDelay;
        const nextDelay = Math.min(currentDelay * 2, this.maxDelay);
        this.delays.set(key, nextDelay);

        // Add jitter (±25%)
        const jitter = currentDelay * 0.25 * (Math.random() * 2 - 1);
        const delayWithJitter = Math.max(100, currentDelay + jitter);

        await this.sleep(delayWithJitter);
        throw error;
      }

      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  reset(key?: string): void {
    if (key) {
      this.delays.delete(key);
    } else {
      this.delays.clear();
    }
  }
}
