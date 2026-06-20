interface Bucket {
  count: number;
  windowStart: number;
}

export class RateLimiter {
  private readonly maxAttempts: number;
  private readonly windowMs: number;
  private readonly buckets = new Map<string, Bucket>();

  constructor(opts: { maxAttempts: number; windowMs: number }) {
    this.maxAttempts = opts.maxAttempts;
    this.windowMs = opts.windowMs;
  }

  check(key: string, now: number = Date.now()): { allowed: boolean; retryAfterMs: number } {
    const bucket = this.buckets.get(key);
    if (!bucket || now - bucket.windowStart >= this.windowMs) {
      this.buckets.set(key, { count: 1, windowStart: now });
      return { allowed: true, retryAfterMs: 0 };
    }
    if (bucket.count < this.maxAttempts) {
      bucket.count += 1;
      return { allowed: true, retryAfterMs: 0 };
    }
    return { allowed: false, retryAfterMs: bucket.windowStart + this.windowMs - now };
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }
}

export const loginRateLimiter = new RateLimiter({
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
});
