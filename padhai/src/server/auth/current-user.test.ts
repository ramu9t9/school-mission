import { describe, it, expect, afterEach } from 'vitest';
import { createTestDb } from '../db/test-db';
import type { Db } from '../db/client';
import { createUserAccount } from './users';
import { createSession } from './session';
import { resolveUserFromToken } from './current-user';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

describe('resolveUserFromToken (route-protection core)', () => {
  it('returns null when no token is present', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    expect(await resolveUserFromToken(ctx.db, undefined)).toBeNull();
  });

  it('returns null for an invalid token', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    expect(await resolveUserFromToken(ctx.db, 'garbage')).toBeNull();
  });

  it('returns the user for a valid session token', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    const user = await createUserAccount(ctx.db, { name: 'Ram', email: 'ram@example.com', password: 'supersecret' });
    const { token } = await createSession(ctx.db, user.id);
    const resolved = await resolveUserFromToken(ctx.db, token);
    expect(resolved?.id).toBe(user.id);
  });
});
