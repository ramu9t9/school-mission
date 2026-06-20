'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb } from '../db/client';
import { authenticate } from './authenticate';
import { loginRateLimiter } from './rate-limit';
import { revokeSession, revokeAllSessionsForUser, SESSION_TTL_MS } from './session';
import { resolveUserFromToken, SESSION_COOKIE } from './current-user';
import { env } from '@/lib/env';

export type LoginState = { error: string | null };

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    expires,
  };
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const hdrs = await headers();
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';

  const result = await authenticate(getDb(), { email, password, ip }, loginRateLimiter);
  if (!result.ok) {
    return {
      error:
        result.reason === 'rate_limited'
          ? 'Too many attempts. Please wait a few minutes and try again.'
          : 'Invalid email or password.',
    };
  }
  const store = await cookies();
  store.set(SESSION_COOKIE, result.token, cookieOptions(new Date(Date.now() + SESSION_TTL_MS)));
  redirect('/');
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await revokeSession(getDb(), token);
  store.delete(SESSION_COOKIE);
  redirect('/login');
}

export async function logoutEverywhereAction(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const user = await resolveUserFromToken(getDb(), token);
  if (user) await revokeAllSessionsForUser(getDb(), user.id);
  store.delete(SESSION_COOKIE);
  redirect('/login');
}
