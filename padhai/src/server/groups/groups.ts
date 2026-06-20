import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { watchedGroups, type WatchedGroup } from '../db/schema';

const addGroupSchema = z.object({
  kidId: z.number().int().positive(),
  groupName: z.string().min(1, 'Group name is required'),
  groupId: z.string().optional(),
});

export async function addGroup(
  db: Db,
  input: z.input<typeof addGroupSchema>,
): Promise<WatchedGroup> {
  const parsed = addGroupSchema.parse(input);
  const [existing] = await db
    .select()
    .from(watchedGroups)
    .where(and(eq(watchedGroups.kidId, parsed.kidId), eq(watchedGroups.groupName, parsed.groupName)));

  if (existing) {
    const [updated] = await db
      .update(watchedGroups)
      .set({ active: true, groupId: parsed.groupId ?? existing.groupId })
      .where(eq(watchedGroups.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(watchedGroups)
    .values({ kidId: parsed.kidId, groupName: parsed.groupName, groupId: parsed.groupId ?? null })
    .returning();
  return created;
}

export async function listGroupsForKid(
  db: Db,
  kidId: number,
  opts: { includeInactive?: boolean } = {},
): Promise<WatchedGroup[]> {
  const where = opts.includeInactive
    ? eq(watchedGroups.kidId, kidId)
    : and(eq(watchedGroups.kidId, kidId), eq(watchedGroups.active, true));
  return db.select().from(watchedGroups).where(where);
}

export async function setGroupActive(db: Db, id: number, active: boolean): Promise<WatchedGroup> {
  const [group] = await db
    .update(watchedGroups)
    .set({ active })
    .where(eq(watchedGroups.id, id))
    .returning();
  return group;
}
