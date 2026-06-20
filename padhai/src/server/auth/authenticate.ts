import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { users } from '../db/schema';
import { getUserByEmail } from './users';
import { verifyPassword } from './password';
import { createSession } from './session';
import type { RateLimiter } from './rate-limit';

export type AuthResult =
  | { ok: true; token: string; expiresAt: Date }
  | { ok: false; reason: 'invalid_credentials' | 'rate_limited'; retryAfterMs?: number };

export async function authenticate(
  db: Db,
  input: { email: string; password: string; ip: string },
  limiter: RateLimiter,
  now: Date = new Date(),
): Promise<AuthResult> {
  const email = input.email.toLowerCase();
  const ipKey = `ip:${input.ip}`;
  const emailKey = `email:${email}`;

  const ipCheck = limiter.check(ipKey, now.getTime());
  const emailCheck = limiter.check(emailKey, now.getTime());
  if (!ipCheck.allowed || !emailCheck.allowed) {
    return {
      ok: false,
      reason: 'rate_limited',
      retryAfterMs: Math.max(ipCheck.retryAfterMs, emailCheck.retryAfterMs),
    };
  }

  const user = await getUserByEmail(db, email);
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    return { ok: false, reason: 'invalid_credentials' };
  }

  const { token, expiresAt } = await createSession(db, user.id, now);
  await db.update(users).set({ lastLogin: now }).where(eq(users.id, user.id));
  limiter.reset(ipKey);
  limiter.reset(emailKey);
  return { ok: true, token, expiresAt };
}
