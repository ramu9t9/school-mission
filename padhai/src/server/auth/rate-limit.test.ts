import { describe, it, expect } from 'vitest';
import { RateLimiter } from './rate-limit';

describe('RateLimiter', () => {
  it('allows up to maxAttempts then blocks', () => {
    const rl = new RateLimiter({ maxAttempts: 3, windowMs: 1000 });
    expect(rl.check('k', 0).allowed).toBe(true);
    expect(rl.check('k', 1).allowed).toBe(true);
    expect(rl.check('k', 2).allowed).toBe(true);
    const blocked = rl.check('k', 3);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it('resets after the window elapses', () => {
    const rl = new RateLimiter({ maxAttempts: 1, windowMs: 1000 });
    expect(rl.check('k', 0).allowed).toBe(true);
    expect(rl.check('k', 500).allowed).toBe(false);
    expect(rl.check('k', 1001).allowed).toBe(true);
  });

  it('isolates keys (per IP / per email)', () => {
    const rl = new RateLimiter({ maxAttempts: 1, windowMs: 1000 });
    expect(rl.check('ip:1.1.1.1', 0).allowed).toBe(true);
    expect(rl.check('ip:1.1.1.1', 0).allowed).toBe(false);
    expect(rl.check('email:a@b.com', 0).allowed).toBe(true);
  });

  it('reset() clears a key', () => {
    const rl = new RateLimiter({ maxAttempts: 1, windowMs: 1000 });
    expect(rl.check('k', 0).allowed).toBe(true);
    expect(rl.check('k', 0).allowed).toBe(false);
    rl.reset('k');
    expect(rl.check('k', 0).allowed).toBe(true);
  });
});
