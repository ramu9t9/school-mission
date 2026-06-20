import { describe, it, expect, afterEach } from 'vitest';
import { createTestDb } from './test-db';
import { kids, watchedGroups } from './schema';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

describe('kids + watched_groups schema (PGlite)', () => {
  it('round-trips a kid with defaults', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    const [kid] = await ctx.db.insert(kids).values({ name: 'Aarav' }).returning();
    expect(kid.id).toBeGreaterThan(0);
    expect(kid.active).toBe(true);
    expect(kid.avatarColor).toBe('#2563EB');
  });

  it('links a watched group to a kid and enforces (kid, name) uniqueness', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    const [kid] = await ctx.db.insert(kids).values({ name: 'Diya' }).returning();
    await ctx.db.insert(watchedGroups).values({ kidId: kid.id, groupName: 'Class 3A' });
    await expect(
      ctx.db.insert(watchedGroups).values({ kidId: kid.id, groupName: 'Class 3A' }),
    ).rejects.toThrow();
  });
});
