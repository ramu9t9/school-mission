import { describe, it, expect, afterEach } from 'vitest';
import { createTestDb } from '../db/test-db';
import { createKid, listKids, getKid, updateKid, setKidActive } from './kids';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

describe('kids service (PGlite)', () => {
  it('creates and lists active kids', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    await createKid(ctx.db, { name: 'Aarav', grade: '5', section: 'B' });
    await createKid(ctx.db, { name: 'Diya', grade: '3' });
    const kids = await listKids(ctx.db);
    expect(kids.map((k) => k.name)).toEqual(['Aarav', 'Diya']);
  });

  it('rejects an empty name', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    await expect(createKid(ctx.db, { name: '' })).rejects.toThrow();
  });

  it('updates a kid', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    const kid = await createKid(ctx.db, { name: 'Aarav', grade: '5' });
    const updated = await updateKid(ctx.db, kid.id, { grade: '6', section: 'A' });
    expect(updated.grade).toBe('6');
    expect(updated.section).toBe('A');
  });

  it('soft-deletes a kid (excluded from active list, still fetchable)', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    const kid = await createKid(ctx.db, { name: 'Temp' });
    await setKidActive(ctx.db, kid.id, false);
    expect(await listKids(ctx.db)).toHaveLength(0);
    expect(await listKids(ctx.db, { includeInactive: true })).toHaveLength(1);
    expect((await getKid(ctx.db, kid.id))?.active).toBe(false);
  });
});
