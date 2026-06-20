import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../db/test-db';
import { users, sessions } from '../db/schema';
import type { Db } from '../db/client';
import {
  generateSessionToken, hashToken, createSession,
  validateSessionToken, revokeSession, revokeAllSessionsForUser, SESSION_TTL_MS,
} from './session';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

async function seedUser(db: Db): Promise<number> {
  const [u] = await db.insert(users)
    .values({ name: 'Ram', email: 'ram@example.com', passwordHash: 'x' }).returning();
  return u.id;
}

describe('session tokens', () => {
  it('generates a 256-bit hex token', () => {
    const t = generateSessionToken();
    expect(t).toMatch(/^[0-9a-f]{64}$/);
  });
  it('hashes deterministically and not to the raw token', () => {
    const t = 'abc';
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).not.toBe(t);
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('session lifecycle (PGlite)', () => {
  it('stores only the token hash, not the raw token', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    const userId = await seedUser(ctx.db);
    const { token } = await createSession(ctx.db, userId);
    const rows = await ctx.db.select().from(sessions);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(hashToken(token));
    expect(rows[0].id).not.toBe(token);
  });

  it('validates a fresh token and returns the user', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    const userId = await seedUser(ctx.db);
    const { token } = await createSession(ctx.db, userId);
    const user = await validateSessionToken(ctx.db, token);
    expect(user?.id).toBe(userId);
    expect(user?.email).toBe('ram@example.com');
  });

  it('returns null for an unknown token', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    await seedUser(ctx.db);
    expect(await validateSessionToken(ctx.db, 'nope')).toBeNull();
  });

  it('rejects and deletes an expired session', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    const userId = await seedUser(ctx.db);
    const past = new Date(Date.now() - SESSION_TTL_MS - 1000);
    const { token } = await createSession(ctx.db, userId, past);
    expect(await validateSessionToken(ctx.db, token)).toBeNull();
    expect(await ctx.db.select().from(sessions)).toHaveLength(0);
  });

  it('revokeSession removes only that session (logout)', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    const userId = await seedUser(ctx.db);
    const a = await createSession(ctx.db, userId);
    const b = await createSession(ctx.db, userId);
    await revokeSession(ctx.db, a.token);
    expect(await validateSessionToken(ctx.db, a.token)).toBeNull();
    expect(await validateSessionToken(ctx.db, b.token)).not.toBeNull();
  });

  it('revokeAllSessionsForUser removes every session (logout everywhere)', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    const userId = await seedUser(ctx.db);
    await createSession(ctx.db, userId);
    await createSession(ctx.db, userId);
    await revokeAllSessionsForUser(ctx.db, userId);
    expect(await ctx.db.select().from(sessions).where(eq(sessions.userId, userId))).toHaveLength(0);
  });
});
