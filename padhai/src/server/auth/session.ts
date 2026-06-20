import { randomBytes, createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { sessions, users, type User } from '../db/schema';

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function generateSessionToken(): string {
  return randomBytes(32).toString('hex'); // 256-bit
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(
  db: Db,
  userId: number,
  now: Date = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
  return { token, expiresAt };
}

export async function validateSessionToken(
  db: Db,
  token: string,
  now: Date = new Date(),
): Promise<User | null> {
  const id = hashToken(token);
  const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
  if (!session) return null;
  if (session.expiresAt.getTime() <= now.getTime()) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }
  const [user] = await db.select().from(users).where(eq(users.id, session.userId));
  return user ?? null;
}

export async function revokeSession(db: Db, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

export async function revokeAllSessionsForUser(db: Db, userId: number): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}
