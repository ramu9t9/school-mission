import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Db } from '../db/client';
import { getDb } from '../db/client';
import { validateSessionToken } from './session';
import type { User } from '../db/schema';

export const SESSION_COOKIE = 'padhai_session';

/** Testable core of route protection — no Next runtime needed. */
export async function resolveUserFromToken(db: Db, token: string | undefined): Promise<User | null> {
  if (!token) return null;
  return validateSessionToken(db, token);
}

export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return resolveUserFromToken(getDb(), token);
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}
