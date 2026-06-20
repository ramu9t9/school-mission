import { describe, it, expect, afterEach } from 'vitest';
import { createTestDb } from '../db/test-db';
import { createKid } from '../kids/kids';
import { addGroup, listGroupsForKid, setGroupActive } from './groups';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

describe('watched-groups service (PGlite)', () => {
  it('adds a group with id + name and lists it for the kid', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    const kid = await createKid(ctx.db, { name: 'Aarav' });
    await addGroup(ctx.db, { kidId: kid.id, groupName: 'Class 5B', groupId: '120363@g.us' });
    const groups = await listGroupsForKid(ctx.db, kid.id);
    expect(groups).toHaveLength(1);
    expect(groups[0].groupName).toBe('Class 5B');
    expect(groups[0].groupId).toBe('120363@g.us');
  });

  it('rejects an empty group name', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    const kid = await createKid(ctx.db, { name: 'Aarav' });
    await expect(addGroup(ctx.db, { kidId: kid.id, groupName: '' })).rejects.toThrow();
  });

  it('reactivates instead of duplicating an existing (kid, name)', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    const kid = await createKid(ctx.db, { name: 'Aarav' });
    const first = await addGroup(ctx.db, { kidId: kid.id, groupName: 'Class 5B' });
    await setGroupActive(ctx.db, first.id, false);
    const again = await addGroup(ctx.db, { kidId: kid.id, groupName: 'Class 5B', groupId: 'g1' });
    expect(again.id).toBe(first.id);
    expect(again.active).toBe(true);
    expect(again.groupId).toBe('g1');
    expect(await listGroupsForKid(ctx.db, kid.id)).toHaveLength(1);
  });

  it('soft-deletes a group (excluded from active list)', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    const kid = await createKid(ctx.db, { name: 'Aarav' });
    const g = await addGroup(ctx.db, { kidId: kid.id, groupName: 'Class 5B' });
    await setGroupActive(ctx.db, g.id, false);
    expect(await listGroupsForKid(ctx.db, kid.id)).toHaveLength(0);
    expect(await listGroupsForKid(ctx.db, kid.id, { includeInactive: true })).toHaveLength(1);
  });
});
