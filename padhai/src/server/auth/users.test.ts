import { describe, it, expect, afterEach } from 'vitest';
import { createTestDb } from '../db/test-db';
import type { Db } from '../db/client';
import { createUserAccount, getUserByEmail } from './users';
import { verifyPassword } from './password';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

describe('createUserAccount (PGlite)', () => {
  it('creates a user and stores a bcrypt hash, never the plaintext', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    const user = await createUserAccount(ctx.db, {
      name: 'Ram', email: 'Ram@Example.com', password: 'supersecret',
    });
    expect(user.email).toBe('ram@example.com'); // lowercased
    expect(user.passwordHash).not.toBe('supersecret');
    expect(await verifyPassword('supersecret', user.passwordHash)).toBe(true);
  });

  it('rejects a duplicate email', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    await createUserAccount(ctx.db, { name: 'A', email: 'dup@example.com', password: 'password1' });
    await expect(
      createUserAccount(ctx.db, { name: 'B', email: 'dup@example.com', password: 'password2' }),
    ).rejects.toThrow(/already exists/i);
  });

  it('rejects an invalid email and a too-short password', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    await expect(
      createUserAccount(ctx.db, { name: 'A', email: 'not-an-email', password: 'password1' }),
    ).rejects.toThrow();
    await expect(
      createUserAccount(ctx.db, { name: 'A', email: 'a@b.com', password: 'short' }),
    ).rejects.toThrow();
  });

  it('getUserByEmail finds by lowercased email', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    await createUserAccount(ctx.db, { name: 'A', email: 'Find@Me.com', password: 'password1' });
    const found = await getUserByEmail(ctx.db, 'find@me.com');
    expect(found?.name).toBe('A');
  });
});
