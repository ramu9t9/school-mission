import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from './test-db';
import { users } from './schema';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

describe('database schema (PGlite)', () => {
  it('migrates and round-trips a user row', async () => {
    const ctx = await createTestDb();
    close = ctx.close;
    const [inserted] = await ctx.db
      .insert(users)
      .values({ name: 'Ram', email: 'ram@example.com', passwordHash: 'x' })
      .returning();
    expect(inserted.id).toBeGreaterThan(0);
    expect(inserted.role).toBe('parent');

    const found = await ctx.db.select().from(users).where(eq(users.email, 'ram@example.com'));
    expect(found).toHaveLength(1);
    expect(found[0].name).toBe('Ram');
  });

  it('enforces the unique email constraint', async () => {
    const ctx = await createTestDb();
    close = ctx.close;
    await ctx.db.insert(users).values({ name: 'A', email: 'dup@example.com', passwordHash: 'x' });
    await expect(
      ctx.db.insert(users).values({ name: 'B', email: 'dup@example.com', passwordHash: 'y' }),
    ).rejects.toThrow();
  });
});
