import { z } from 'zod';
import { eq, asc } from 'drizzle-orm';
import type { Db } from '../db/client';
import { kids, type Kid } from '../db/schema';

const createKidSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  grade: z.string().optional(),
  section: z.string().optional(),
  schoolName: z.string().optional(),
  avatarColor: z.string().optional(),
});

export async function createKid(
  db: Db,
  input: z.input<typeof createKidSchema>,
): Promise<Kid> {
  const parsed = createKidSchema.parse(input);
  const [kid] = await db.insert(kids).values(parsed).returning();
  return kid;
}

export async function listKids(db: Db, opts: { includeInactive?: boolean } = {}): Promise<Kid[]> {
  const where = opts.includeInactive ? undefined : eq(kids.active, true);
  return db.select().from(kids).where(where).orderBy(asc(kids.id));
}

export async function getKid(db: Db, id: number): Promise<Kid | null> {
  const [kid] = await db.select().from(kids).where(eq(kids.id, id));
  return kid ?? null;
}

const updateKidSchema = createKidSchema.partial();

export async function updateKid(
  db: Db,
  id: number,
  patch: z.input<typeof updateKidSchema>,
): Promise<Kid> {
  const parsed = updateKidSchema.parse(patch);
  const [kid] = await db.update(kids).set(parsed).where(eq(kids.id, id)).returning();
  return kid;
}

export async function setKidActive(db: Db, id: number, active: boolean): Promise<Kid> {
  const [kid] = await db.update(kids).set({ active }).where(eq(kids.id, id)).returning();
  return kid;
}
