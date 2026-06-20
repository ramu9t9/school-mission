import { z } from 'zod';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { users, type User } from '../db/schema';
import { hashPassword } from './password';

const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.email('A valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function getUserByEmail(db: Db, email: string): Promise<User | null> {
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
  return user ?? null;
}

export async function getUserById(db: Db, id: number): Promise<User | null> {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user ?? null;
}

export async function createUserAccount(
  db: Db,
  input: { name: string; email: string; password: string },
): Promise<User> {
  const parsed = createUserSchema.parse(input);
  const email = parsed.email.toLowerCase();
  if (await getUserByEmail(db, email)) {
    throw new Error('A user with that email already exists');
  }
  const passwordHash = await hashPassword(parsed.password);
  const [user] = await db
    .insert(users)
    .values({ name: parsed.name, email, passwordHash })
    .returning();
  return user;
}
