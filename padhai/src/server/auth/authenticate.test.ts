import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../db/test-db';
import type { Db } from '../db/client';
import { users } from '../db/schema';
import { createUserAccount } from './users';
import { validateSessionToken } from './session';
import { RateLimiter } from './rate-limit';
import { authenticate } from './authenticate';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

async function seed(db: Db) {
  await createUserAccount(db, { name: 'Ram', email: 'ram@example.com', password: 'supersecret' });
}
function freshLimiter() { return new RateLimiter({ maxAttempts: 3, windowMs: 60_000 }); }

describe('authenticate (PGlite)', () => {
  it('returns a valid session token on correct credentials', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    await seed(ctx.db);
    const res = await authenticate(ctx.db, { email: 'ram@example.com', password: 'supersecret', ip: '1.1.1.1' }, freshLimiter());
    expect(res.ok).toBe(true);
    if (res.ok) {
      const user = await validateSessionToken(ctx.db, res.token);
      expect(user?.email).toBe('ram@example.com');
    }
  });

  it('updates last_login on success', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    await seed(ctx.db);
    await authenticate(ctx.db, { email: 'ram@example.com', password: 'supersecret', ip: '1.1.1.1' }, freshLimiter());
    const [u] = await ctx.db.select().from(users).where(eq(users.email, 'ram@example.com'));
    expect(u.lastLogin).not.toBeNull();
  });

  it('rejects a wrong password as invalid_credentials', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    await seed(ctx.db);
    const res = await authenticate(ctx.db, { email: 'ram@example.com', password: 'WRONG', ip: '1.1.1.1' }, freshLimiter());
    expect(res).toEqual({ ok: false, reason: 'invalid_credentials' });
  });

  it('rejects an unknown email as invalid_credentials', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    await seed(ctx.db);
    const res = await authenticate(ctx.db, { email: 'nobody@example.com', password: 'whatever8', ip: '1.1.1.1' }, freshLimiter());
    expect(res).toEqual({ ok: false, reason: 'invalid_credentials' });
  });

  it('blocks with rate_limited after too many attempts', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    await seed(ctx.db);
    const limiter = freshLimiter();
    const bad = { email: 'ram@example.com', password: 'WRONG', ip: '9.9.9.9' };
    await authenticate(ctx.db, bad, limiter);
    await authenticate(ctx.db, bad, limiter);
    await authenticate(ctx.db, bad, limiter);
    const res = await authenticate(ctx.db, bad, limiter);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('rate_limited');
  });
});
