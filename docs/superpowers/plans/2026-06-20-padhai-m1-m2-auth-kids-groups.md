# PadhAI — M1 (Auth) + M2 (Kids & Groups) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a simple single-family authentication system (M1) and the Kids + WhatsApp-Groups data model with CRUD UI (M2) on top of the M0 scaffold, with a Postgres + Drizzle data layer that tests run against in-memory.

**Architecture:** A Postgres data layer (Drizzle ORM, `postgres.js` driver) is introduced in M1's first task; tests run against PGlite (in-memory Postgres) so `npm test` needs no external database. Pure, injectable services (`server/auth`, `server/kids`, `server/groups`) hold all logic and are unit-tested directly against a PGlite database; thin Next.js server actions / server components wrap them and handle cookies, redirects, and forms. Route protection is a server-side `requireUser()` guard called in the `(app)` layout.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript 5 (strict) · Tailwind 4 · shadcn/ui · Drizzle ORM 0.45 + drizzle-kit 0.31 · `postgres` 3.4 (runtime) · `@electric-sql/pglite` 0.5 (tests) · `bcryptjs` 3 · Vitest 4 · zod 4.

## Global Constraints

- **App root:** all code lives in `padhai/`. Never touch the gitignored legacy `digital-scout/`.
- **Single-tenant:** one family; NO `family_id` / tenant columns anywhere.
- **Single git repo** at `g:\Projects\School Mission`, branch `main`. No nested repo in `padhai/`.
- **Secrets:** `.env` is never committed; only `.env.example` placeholders. `.env.example` already has a `!.env.example` gitignore negation — keep it tracked.
- **Path alias:** `@/*` → `padhai/src/*`.
- **Mobile-first** UI; bottom nav on mobile, sidebar on desktop (from M0).
- **Auth rules (from the design spec):** bcrypt cost 12 · 256-bit session token · store only the **SHA-256 hash** of the token in DB · cookie `httpOnly` + `Secure` (in production) + `SameSite=Lax` · 30-day expiry · logout + logout-everywhere · **no public signup** · **no public forgot-password** (reset via CLI) · login rate limiting per IP and per email.
- **Tests run against PGlite** (in-memory); never require a live Postgres for `npm test`.
- **TDD:** for every logic unit, write the failing test first, watch it fail, then implement.
- **Commits:** one per task, small; do NOT sign; end every message with:
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  ```
- **Do not push** unless the user explicitly asks.
- **Milestone separation (execution rule):** implement **all of M1 first and stop for review**. Do NOT start M2 coding until M1 is complete, tested, committed, (pushed if approved), and the user approves moving to M2.

---

## Risks & Decisions

1. **DB driver split — `postgres.js` (runtime) vs PGlite (tests).** Both speak the same Drizzle `pg-core` schema. Services accept a `db` handle (dependency injection), so the same code runs against either. Decision: services never import the runtime singleton; they receive `db`.
2. **Migrations are the source of truth for both.** `drizzle-kit generate` writes SQL to `padhai/drizzle/`. Tests apply those same migrations to PGlite via the Drizzle PGlite migrator — so a schema bug fails tests before it reaches Postgres.
3. **`bcryptjs` not `bcrypt`.** Pure-JS, no node-gyp/native build — reliable on the Windows dev box. Cost 12 per the spec.
4. **Route protection via server component, not edge middleware.** Session validation needs a Postgres lookup; Next edge middleware can't reach Postgres. The `(app)/layout.tsx` server component calls `requireUser()` which validates the session and `redirect('/login')`s when invalid.
5. **Sliding renewal deferred.** M1 ships a fixed 30-day expiry, refreshed on each successful login. True per-request sliding renewal needs Node-runtime middleware and is deferred (not in the M1 requirements list). Documented here so it's a conscious gap.
6. **Rate-limit store is in-process memory.** Single VPS instance → a per-process `Map` is sufficient; it resets on restart (acceptable for brute-force mitigation). Swappable later. Decision: encapsulate behind a `RateLimiter` class so the backing store can change without touching callers.
7. **`watched_groups` uniqueness.** `group_id` may be unknown at entry time (parent types a name before the WhatsApp id is known), so `group_id` is nullable and the unique key is `(kid_id, group_name)`. Matching prefers `group_id` when present, else `group_name`.
8. **`DATABASE_URL` optional in env schema.** Tests use PGlite and never set it. The runtime db singleton throws a clear error if it's accessed without `DATABASE_URL`. So dev/prod must set it; tests don't need it.

---

## Security Checklist (verified across M1)

- [ ] No plaintext passwords — only bcrypt hashes stored (`users.password_hash`).
- [ ] Only the **SHA-256 hash** of the session token is stored (`sessions.id`); the raw token lives only in the cookie.
- [ ] Session cookie is `httpOnly`.
- [ ] Session cookie is `Secure` in production (`env.NODE_ENV === 'production'`).
- [ ] Session cookie is `SameSite=Lax`.
- [ ] No public signup route — first account + spouse via `scripts/create-user.ts` CLI only.
- [ ] No public forgot-password route — reset via `scripts/set-password.ts` CLI only.
- [ ] No secrets committed; `.env` untracked; `.env.example` placeholders only.
- [ ] Route protection verified — `(app)` pages redirect to `/login` without a valid session.
- [ ] Login rate-limited per IP and per email.

---

# MILESTONE M1 · AUTH

## File Structure (M1)

```
padhai/
├── drizzle.config.ts                       # drizzle-kit config (NEW)
├── drizzle/                                 # generated SQL migrations (NEW)
└── src/
    ├── lib/env.ts                           # MODIFY: add DATABASE_URL
    ├── server/
    │   ├── db/
    │   │   ├── schema.ts                     # users + sessions tables (NEW)
    │   │   ├── client.ts                     # runtime postgres.js db singleton (NEW)
    │   │   └── test-db.ts                     # PGlite test db factory (NEW, test-only)
    │   └── auth/
    │       ├── password.ts                   # hashPassword / verifyPassword (NEW)
    │       ├── password.test.ts
    │       ├── session.ts                     # token + session lifecycle (NEW)
    │       ├── session.test.ts
    │       ├── rate-limit.ts                  # RateLimiter (NEW)
    │       ├── rate-limit.test.ts
    │       ├── users.ts                       # createUserAccount + lookups (NEW)
    │       ├── users.test.ts
    │       ├── authenticate.ts                # authenticate() orchestration (NEW)
    │       ├── authenticate.test.ts
    │       ├── current-user.ts                # cookie + getCurrentUser/requireUser (NEW)
    │       └── actions.ts                     # login/logout/logoutEverywhere server actions (NEW)
    ├── scripts/create-user.ts                # CLI (NEW)
    └── app/
        ├── login/page.tsx                     # login page (NEW)
        └── (app)/layout.tsx                   # MODIFY: requireUser() guard + logout UI
```

---

## Task M1.1: Database foundation — Drizzle + Postgres + PGlite test harness + users/sessions schema

**Files:**
- Modify: `padhai/src/lib/env.ts`
- Create: `padhai/src/server/db/schema.ts`, `padhai/src/server/db/client.ts`, `padhai/src/server/db/test-db.ts`, `padhai/drizzle.config.ts`
- Create (generated): `padhai/drizzle/**` (migration SQL)
- Test: `padhai/src/server/db/schema.test.ts`

**Interfaces:**
- Consumes: M0 `env` module.
- Produces:
  - `schema.ts` exports Drizzle tables `users` and `sessions` (and inferred types `User`, `NewUser`, `Session`).
  - `client.ts` exports `getDb(): PostgresJsDatabase<typeof schema>` (throws if `DATABASE_URL` unset) and type `Db` (the Drizzle DB type used everywhere as the injected handle).
  - `test-db.ts` exports `createTestDb(): Promise<{ db: Db; close: () => Promise<void> }>` — a PGlite-backed `Db` with all migrations applied.

- [ ] **Step 1: Install dependencies**

```bash
cd padhai
npm install drizzle-orm postgres
npm install -D drizzle-kit @electric-sql/pglite
```

- [ ] **Step 2: Extend the env schema with DATABASE_URL**

Edit `padhai/src/lib/env.ts` — replace the `envSchema` definition with:

```ts
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_URL: z.url().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1).optional(),
});
```

(Leave the rest of `env.ts` — `parseEnv`, `env` export, `Env` type — unchanged.)

- [ ] **Step 3: Write the schema**

Create `padhai/src/server/db/schema.ts`:

```ts
import { pgTable, serial, text, timestamp, integer } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('parent'),
  lastLogin: timestamp('last_login', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  // id = SHA-256 hash of the cookie token. The raw token is NEVER stored.
  id: text('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
```

- [ ] **Step 4: Write the drizzle-kit config**

Create `padhai/drizzle.config.ts`:

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://localhost:5432/padhai',
  },
});
```

- [ ] **Step 5: Generate the first migration**

```bash
cd padhai && npx drizzle-kit generate --name init_auth
```

Expected: a new SQL file under `padhai/drizzle/` (e.g. `0000_init_auth.sql`) creating `users` and `sessions`, plus a `padhai/drizzle/meta/` journal.

- [ ] **Step 6: Write the runtime db client**

Create `padhai/src/server/db/client.ts`:

```ts
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/lib/env';
import * as schema from './schema';

export type Db = PostgresJsDatabase<typeof schema>;

let _db: Db | null = null;

export function getDb(): Db {
  if (_db) return _db;
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to connect to the database');
  }
  const client = postgres(env.DATABASE_URL);
  _db = drizzle(client, { schema });
  return _db;
}
```

- [ ] **Step 7: Write the PGlite test-db factory**

Create `padhai/src/server/db/test-db.ts`:

```ts
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from './schema';
import type { Db } from './client';

/**
 * Spin up an in-memory Postgres (PGlite) with all migrations applied.
 * Used only by tests so `npm test` needs no external database.
 */
export async function createTestDb(): Promise<{ db: Db; close: () => Promise<void> }> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
  return {
    db: db as unknown as Db,
    close: () => client.close(),
  };
}
```

- [ ] **Step 8: Write the failing schema test**

Create `padhai/src/server/db/schema.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from './test-db';
import { users } from './schema';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

describe('database schema (PGlite)', () => {
  it('migrates and round-trips a user row', async () => {
    const ctx = await createTestDb();
    close = ctx.close;
    const [inserted] = await ctx.db
      .insert(users)
      .values({ name: 'Ram', email: 'ram@example.com', passwordHash: 'x' })
      .returning();
    expect(inserted.id).toBeGreaterThan(0);
    expect(inserted.role).toBe('parent');

    const found = await ctx.db.select().from(users).where(eq(users.email, 'ram@example.com'));
    expect(found).toHaveLength(1);
    expect(found[0].name).toBe('Ram');
  });

  it('enforces the unique email constraint', async () => {
    const ctx = await createTestDb();
    close = ctx.close;
    await ctx.db.insert(users).values({ name: 'A', email: 'dup@example.com', passwordHash: 'x' });
    await expect(
      ctx.db.insert(users).values({ name: 'B', email: 'dup@example.com', passwordHash: 'y' }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 9: Run the test — verify GREEN**

```bash
cd padhai && npm test -- src/server/db/schema.test.ts
```

Expected: PASS — `2 passed (2)`. (The migration generated in Step 5 makes this pass on first run; if it fails with "no migrations", re-run Step 5.)

- [ ] **Step 10: Confirm the app still builds and update `.env.example`**

Append to `padhai/.env.example` (uncomment the DB line by adding a real placeholder above the commented block):

```dotenv
# Database (Postgres). Tests use in-memory PGlite and do not need this.
DATABASE_URL=postgres://padhai:CHANGE_ME@127.0.0.1:5432/padhai
```

Run:

```bash
cd padhai && npm run build
```

Expected: `✓ Compiled successfully`.

- [ ] **Step 11: Commit**

```bash
cd "g:/Projects/School Mission"
git add padhai/package.json padhai/package-lock.json padhai/src/lib/env.ts padhai/src/server/db padhai/drizzle.config.ts padhai/drizzle padhai/.env.example
git commit -m "$(printf 'feat(m1): add drizzle+postgres data layer and users/sessions schema\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task M1.2: Password hashing (bcryptjs, cost 12)

**Files:**
- Create: `padhai/src/server/auth/password.ts`, `padhai/src/server/auth/password.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `hashPassword(plain: string): Promise<string>` — bcrypt hash, cost 12.
  - `verifyPassword(plain: string, hash: string): Promise<boolean>`.

- [ ] **Step 1: Install bcryptjs**

```bash
cd padhai && npm install bcryptjs && npm install -D @types/bcryptjs
```

- [ ] **Step 2: Write the failing test**

Create `padhai/src/server/auth/password.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('never returns the plaintext', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).not.toBe('correct horse battery staple');
    expect(hash).toMatch(/^\$2[aby]\$12\$/); // bcrypt, cost 12
  });

  it('verifies a correct password', async () => {
    const hash = await hashPassword('s3cret-pass');
    expect(await verifyPassword('s3cret-pass', hash)).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('s3cret-pass');
    expect(await verifyPassword('wrong-pass', hash)).toBe(false);
  });

  it('produces different hashes for the same input (salting)', async () => {
    const a = await hashPassword('same');
    const b = await hashPassword('same');
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 3: Run — verify RED**

```bash
cd padhai && npm test -- src/server/auth/password.test.ts
```

Expected: FAIL — `Failed to resolve import "./password"`.

- [ ] **Step 4: Implement**

Create `padhai/src/server/auth/password.ts`:

```ts
import bcrypt from 'bcryptjs';

const COST = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 5: Run — verify GREEN**

```bash
cd padhai && npm test -- src/server/auth/password.test.ts
```

Expected: PASS — `4 passed (4)`.

- [ ] **Step 6: Commit**

```bash
cd "g:/Projects/School Mission"
git add padhai/src/server/auth/password.ts padhai/src/server/auth/password.test.ts padhai/package.json padhai/package-lock.json
git commit -m "$(printf 'feat(m1): add bcrypt password hashing\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task M1.3: Session lifecycle (token, hash-at-rest, expiry, revoke, revoke-all)

**Files:**
- Create: `padhai/src/server/auth/session.ts`, `padhai/src/server/auth/session.test.ts`

**Interfaces:**
- Consumes: `Db` (M1.1), `schema.sessions`/`schema.users`.
- Produces:
  - `SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000`.
  - `generateSessionToken(): string` — 32 random bytes hex (256-bit).
  - `hashToken(token: string): string` — SHA-256 hex.
  - `createSession(db: Db, userId: number, now?: Date): Promise<{ token: string; expiresAt: Date }>` — stores `hashToken(token)` as the row id, never the raw token.
  - `validateSessionToken(db: Db, token: string, now?: Date): Promise<User | null>` — returns the user for a non-expired session, else null (and deletes an expired row).
  - `revokeSession(db: Db, token: string): Promise<void>` — deletes the session for this token (logout).
  - `revokeAllSessionsForUser(db: Db, userId: number): Promise<void>` — logout everywhere.

- [ ] **Step 1: Write the failing test**

Create `padhai/src/server/auth/session.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../db/test-db';
import { users, sessions } from '../db/schema';
import type { Db } from '../db/client';
import {
  generateSessionToken, hashToken, createSession,
  validateSessionToken, revokeSession, revokeAllSessionsForUser, SESSION_TTL_MS,
} from './session';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

async function seedUser(db: Db): Promise<number> {
  const [u] = await db.insert(users)
    .values({ name: 'Ram', email: 'ram@example.com', passwordHash: 'x' }).returning();
  return u.id;
}

describe('session tokens', () => {
  it('generates a 256-bit hex token', () => {
    const t = generateSessionToken();
    expect(t).toMatch(/^[0-9a-f]{64}$/);
  });
  it('hashes deterministically and not to the raw token', () => {
    const t = 'abc';
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).not.toBe(t);
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('session lifecycle (PGlite)', () => {
  it('stores only the token hash, not the raw token', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    const userId = await seedUser(ctx.db);
    const { token } = await createSession(ctx.db, userId);
    const rows = await ctx.db.select().from(sessions);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(hashToken(token));
    expect(rows[0].id).not.toBe(token);
  });

  it('validates a fresh token and returns the user', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    const userId = await seedUser(ctx.db);
    const { token } = await createSession(ctx.db, userId);
    const user = await validateSessionToken(ctx.db, token);
    expect(user?.id).toBe(userId);
    expect(user?.email).toBe('ram@example.com');
  });

  it('returns null for an unknown token', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    await seedUser(ctx.db);
    expect(await validateSessionToken(ctx.db, 'nope')).toBeNull();
  });

  it('rejects and deletes an expired session', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    const userId = await seedUser(ctx.db);
    const past = new Date(Date.now() - SESSION_TTL_MS - 1000);
    const { token } = await createSession(ctx.db, userId, past);
    expect(await validateSessionToken(ctx.db, token)).toBeNull();
    expect(await ctx.db.select().from(sessions)).toHaveLength(0);
  });

  it('revokeSession removes only that session (logout)', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    const userId = await seedUser(ctx.db);
    const a = await createSession(ctx.db, userId);
    const b = await createSession(ctx.db, userId);
    await revokeSession(ctx.db, a.token);
    expect(await validateSessionToken(ctx.db, a.token)).toBeNull();
    expect(await validateSessionToken(ctx.db, b.token)).not.toBeNull();
  });

  it('revokeAllSessionsForUser removes every session (logout everywhere)', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    const userId = await seedUser(ctx.db);
    await createSession(ctx.db, userId);
    await createSession(ctx.db, userId);
    await revokeAllSessionsForUser(ctx.db, userId);
    expect(await ctx.db.select().from(sessions).where(eq(sessions.userId, userId))).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run — verify RED**

```bash
cd padhai && npm test -- src/server/auth/session.test.ts
```

Expected: FAIL — `Failed to resolve import "./session"`.

- [ ] **Step 3: Implement**

Create `padhai/src/server/auth/session.ts`:

```ts
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
```

- [ ] **Step 4: Run — verify GREEN**

```bash
cd padhai && npm test -- src/server/auth/session.test.ts
```

Expected: PASS — `8 passed (8)`.

- [ ] **Step 5: Commit**

```bash
cd "g:/Projects/School Mission"
git add padhai/src/server/auth/session.ts padhai/src/server/auth/session.test.ts
git commit -m "$(printf 'feat(m1): add session lifecycle with hashed tokens\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task M1.4: Login rate limiter (per IP + per email)

**Files:**
- Create: `padhai/src/server/auth/rate-limit.ts`, `padhai/src/server/auth/rate-limit.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `class RateLimiter` with `constructor(opts: { maxAttempts: number; windowMs: number })`, `check(key: string, now?: number): { allowed: boolean; retryAfterMs: number }` (records the attempt when allowed), and `reset(key: string): void`.
  - `loginRateLimiter` — a shared instance: `new RateLimiter({ maxAttempts: 5, windowMs: 15 * 60 * 1000 })`.

- [ ] **Step 1: Write the failing test**

Create `padhai/src/server/auth/rate-limit.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { RateLimiter } from './rate-limit';

describe('RateLimiter', () => {
  it('allows up to maxAttempts then blocks', () => {
    const rl = new RateLimiter({ maxAttempts: 3, windowMs: 1000 });
    expect(rl.check('k', 0).allowed).toBe(true);
    expect(rl.check('k', 1).allowed).toBe(true);
    expect(rl.check('k', 2).allowed).toBe(true);
    const blocked = rl.check('k', 3);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it('resets after the window elapses', () => {
    const rl = new RateLimiter({ maxAttempts: 1, windowMs: 1000 });
    expect(rl.check('k', 0).allowed).toBe(true);
    expect(rl.check('k', 500).allowed).toBe(false);
    expect(rl.check('k', 1001).allowed).toBe(true);
  });

  it('isolates keys (per IP / per email)', () => {
    const rl = new RateLimiter({ maxAttempts: 1, windowMs: 1000 });
    expect(rl.check('ip:1.1.1.1', 0).allowed).toBe(true);
    expect(rl.check('ip:1.1.1.1', 0).allowed).toBe(false);
    expect(rl.check('email:a@b.com', 0).allowed).toBe(true);
  });

  it('reset() clears a key', () => {
    const rl = new RateLimiter({ maxAttempts: 1, windowMs: 1000 });
    expect(rl.check('k', 0).allowed).toBe(true);
    expect(rl.check('k', 0).allowed).toBe(false);
    rl.reset('k');
    expect(rl.check('k', 0).allowed).toBe(true);
  });
});
```

- [ ] **Step 2: Run — verify RED**

```bash
cd padhai && npm test -- src/server/auth/rate-limit.test.ts
```

Expected: FAIL — `Failed to resolve import "./rate-limit"`.

- [ ] **Step 3: Implement**

Create `padhai/src/server/auth/rate-limit.ts`:

```ts
interface Bucket {
  count: number;
  windowStart: number;
}

export class RateLimiter {
  private readonly maxAttempts: number;
  private readonly windowMs: number;
  private readonly buckets = new Map<string, Bucket>();

  constructor(opts: { maxAttempts: number; windowMs: number }) {
    this.maxAttempts = opts.maxAttempts;
    this.windowMs = opts.windowMs;
  }

  check(key: string, now: number = Date.now()): { allowed: boolean; retryAfterMs: number } {
    const bucket = this.buckets.get(key);
    if (!bucket || now - bucket.windowStart >= this.windowMs) {
      this.buckets.set(key, { count: 1, windowStart: now });
      return { allowed: true, retryAfterMs: 0 };
    }
    if (bucket.count < this.maxAttempts) {
      bucket.count += 1;
      return { allowed: true, retryAfterMs: 0 };
    }
    return { allowed: false, retryAfterMs: bucket.windowStart + this.windowMs - now };
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }
}

export const loginRateLimiter = new RateLimiter({
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
});
```

- [ ] **Step 4: Run — verify GREEN**

```bash
cd padhai && npm test -- src/server/auth/rate-limit.test.ts
```

Expected: PASS — `4 passed (4)`.

- [ ] **Step 5: Commit**

```bash
cd "g:/Projects/School Mission"
git add padhai/src/server/auth/rate-limit.ts padhai/src/server/auth/rate-limit.test.ts
git commit -m "$(printf 'feat(m1): add login rate limiter\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task M1.5: User creation service + create-user CLI

**Files:**
- Create: `padhai/src/server/auth/users.ts`, `padhai/src/server/auth/users.test.ts`, `padhai/src/scripts/create-user.ts`
- Modify: `padhai/package.json` (add a `create-user` script)

**Interfaces:**
- Consumes: `Db`, `hashPassword` (M1.2), `schema.users`.
- Produces:
  - `getUserByEmail(db: Db, email: string): Promise<User | null>`.
  - `getUserById(db: Db, id: number): Promise<User | null>`.
  - `createUserAccount(db: Db, input: { name: string; email: string; password: string }): Promise<User>` — validates with zod (name ≥ 1, email format, password ≥ 8), lowercases email, hashes the password, inserts; throws `Error('A user with that email already exists')` on duplicate.

- [ ] **Step 1: Write the failing test**

Create `padhai/src/server/auth/users.test.ts`:

```ts
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
```

- [ ] **Step 2: Run — verify RED**

```bash
cd padhai && npm test -- src/server/auth/users.test.ts
```

Expected: FAIL — `Failed to resolve import "./users"`.

- [ ] **Step 3: Implement the service**

Create `padhai/src/server/auth/users.ts`:

```ts
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
```

(Note: zod 4 exposes `z.email()` as a top-level validator.)

- [ ] **Step 4: Run — verify GREEN**

```bash
cd padhai && npm test -- src/server/auth/users.test.ts
```

Expected: PASS — `4 passed (4)`.

- [ ] **Step 5: Write the CLI**

Create `padhai/src/scripts/create-user.ts`:

```ts
import { parseArgs } from 'node:util';
import { getDb } from '../server/db/client';
import { createUserAccount } from '../server/auth/users';

async function main() {
  const { values } = parseArgs({
    options: {
      name: { type: 'string' },
      email: { type: 'string' },
      password: { type: 'string' },
    },
  });
  if (!values.name || !values.email || !values.password) {
    console.error('Usage: tsx src/scripts/create-user.ts --name "Ram" --email ram@example.com --password "<min 8 chars>"');
    process.exit(1);
  }
  const db = getDb();
  const user = await createUserAccount(db, {
    name: values.name,
    email: values.email,
    password: values.password,
  });
  console.log(`Created user #${user.id}: ${user.name} <${user.email}>`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to create user:', err instanceof Error ? err.message : err);
  process.exit(1);
});
```

- [ ] **Step 6: Add the npm script and tsx**

```bash
cd padhai && npm install -D tsx
```

In `padhai/package.json` add to `scripts`:

```json
    "create-user": "tsx src/scripts/create-user.ts"
```

- [ ] **Step 7: Verify the full suite passes and the app builds**

```bash
cd padhai && npm test && npm run build
```

Expected: all suites pass; `✓ Compiled successfully`. (The CLI is not unit-tested directly — its logic lives in the tested `createUserAccount`; it is a thin argv wrapper.)

- [ ] **Step 8: Commit**

```bash
cd "g:/Projects/School Mission"
git add padhai/src/server/auth/users.ts padhai/src/server/auth/users.test.ts padhai/src/scripts/create-user.ts padhai/package.json padhai/package-lock.json
git commit -m "$(printf 'feat(m1): add user creation service and create-user CLI\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task M1.6: Authenticate orchestration (rate-limit + verify + session)

**Files:**
- Create: `padhai/src/server/auth/authenticate.ts`, `padhai/src/server/auth/authenticate.test.ts`

**Interfaces:**
- Consumes: `Db`, `getUserByEmail` (M1.5), `verifyPassword` (M1.2), `createSession` (M1.3), `RateLimiter` (M1.4), `schema.users`.
- Produces:
  - `type AuthResult = { ok: true; token: string; expiresAt: Date } | { ok: false; reason: 'invalid_credentials' | 'rate_limited'; retryAfterMs?: number }`.
  - `authenticate(db: Db, input: { email: string; password: string; ip: string }, limiter: RateLimiter, now?: Date): Promise<AuthResult>` — checks the rate limiter (keyed on both `ip:<ip>` and `email:<email>`), verifies the password, on success creates a session, updates `users.last_login`, resets both limiter keys, and returns the token. A bad password returns `invalid_credentials` (without revealing which field). When rate-limited it returns `rate_limited` without checking the password.

- [ ] **Step 1: Write the failing test**

Create `padhai/src/server/auth/authenticate.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../db/test-db';
import type { Db } from '../db/client';
import { users } from '../db/schema';
import { createUserAccount } from './users';
import { validateSessionToken } from './session';
import { RateLimiter } from './rate-limit';
import { authenticate } from './authenticate';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

async function seed(db: Db) {
  await createUserAccount(db, { name: 'Ram', email: 'ram@example.com', password: 'supersecret' });
}
function freshLimiter() { return new RateLimiter({ maxAttempts: 3, windowMs: 60_000 }); }

describe('authenticate (PGlite)', () => {
  it('returns a valid session token on correct credentials', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    await seed(ctx.db);
    const res = await authenticate(ctx.db, { email: 'ram@example.com', password: 'supersecret', ip: '1.1.1.1' }, freshLimiter());
    expect(res.ok).toBe(true);
    if (res.ok) {
      const user = await validateSessionToken(ctx.db, res.token);
      expect(user?.email).toBe('ram@example.com');
    }
  });

  it('updates last_login on success', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    await seed(ctx.db);
    await authenticate(ctx.db, { email: 'ram@example.com', password: 'supersecret', ip: '1.1.1.1' }, freshLimiter());
    const [u] = await ctx.db.select().from(users).where(eq(users.email, 'ram@example.com'));
    expect(u.lastLogin).not.toBeNull();
  });

  it('rejects a wrong password as invalid_credentials', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    await seed(ctx.db);
    const res = await authenticate(ctx.db, { email: 'ram@example.com', password: 'WRONG', ip: '1.1.1.1' }, freshLimiter());
    expect(res).toEqual({ ok: false, reason: 'invalid_credentials' });
  });

  it('rejects an unknown email as invalid_credentials', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    await seed(ctx.db);
    const res = await authenticate(ctx.db, { email: 'nobody@example.com', password: 'whatever8', ip: '1.1.1.1' }, freshLimiter());
    expect(res).toEqual({ ok: false, reason: 'invalid_credentials' });
  });

  it('blocks with rate_limited after too many attempts', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    await seed(ctx.db);
    const limiter = freshLimiter();
    const bad = { email: 'ram@example.com', password: 'WRONG', ip: '9.9.9.9' };
    await authenticate(ctx.db, bad, limiter);
    await authenticate(ctx.db, bad, limiter);
    await authenticate(ctx.db, bad, limiter);
    const res = await authenticate(ctx.db, bad, limiter);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('rate_limited');
  });
});
```

- [ ] **Step 2: Run — verify RED**

```bash
cd padhai && npm test -- src/server/auth/authenticate.test.ts
```

Expected: FAIL — `Failed to resolve import "./authenticate"`.

- [ ] **Step 3: Implement**

Create `padhai/src/server/auth/authenticate.ts`:

```ts
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
```

- [ ] **Step 4: Run — verify GREEN**

```bash
cd padhai && npm test -- src/server/auth/authenticate.test.ts
```

Expected: PASS — `5 passed (5)`.

- [ ] **Step 5: Commit**

```bash
cd "g:/Projects/School Mission"
git add padhai/src/server/auth/authenticate.ts padhai/src/server/auth/authenticate.test.ts
git commit -m "$(printf 'feat(m1): add authenticate orchestration\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task M1.7: Cookies, current-user helpers, login page, server actions, route protection

**Files:**
- Create: `padhai/src/server/auth/current-user.ts`, `padhai/src/server/auth/actions.ts`, `padhai/src/app/login/page.tsx`, `padhai/src/components/auth/logout-button.tsx`
- Modify: `padhai/src/app/(app)/layout.tsx` (add `requireUser()` guard + a logout control), `padhai/src/app/(app)/settings/page.tsx` (add a "log out everywhere" control)
- Test: `padhai/src/server/auth/current-user.test.ts`

**Interfaces:**
- Consumes: `getDb` (M1.1), `validateSessionToken`/`revokeSession`/`revokeAllSessionsForUser` (M1.3), `getUserById` (M1.5), `authenticate` + `loginRateLimiter` (M1.4/M1.6), `User` type.
- Produces:
  - `SESSION_COOKIE = 'padhai_session'`.
  - `resolveUserFromToken(db: Db, token: string | undefined): Promise<User | null>` — null when token absent/invalid (the testable core of the guard).
  - `getCurrentUser(): Promise<User | null>` — reads the cookie, calls `resolveUserFromToken` against the runtime db.
  - `requireUser(): Promise<User>` — `getCurrentUser()` or `redirect('/login')`.
  - Server actions in `actions.ts`: `loginAction(prevState, formData)`, `logoutAction()`, `logoutEverywhereAction()`.

- [ ] **Step 1: Write the failing test for the guard core**

Create `padhai/src/server/auth/current-user.test.ts`:

```ts
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
```

- [ ] **Step 2: Run — verify RED**

```bash
cd padhai && npm test -- src/server/auth/current-user.test.ts
```

Expected: FAIL — `Failed to resolve import "./current-user"`.

- [ ] **Step 3: Implement current-user helpers**

Create `padhai/src/server/auth/current-user.ts`:

```ts
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
```

- [ ] **Step 4: Run — verify GREEN**

```bash
cd padhai && npm test -- src/server/auth/current-user.test.ts
```

Expected: PASS — `3 passed (3)`.

- [ ] **Step 5: Implement the server actions**

Create `padhai/src/server/auth/actions.ts`:

```ts
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
```

- [ ] **Step 6: Build the login page**

Create `padhai/src/app/login/page.tsx`:

```tsx
'use client';

import { useActionState } from 'react';
import { loginAction, type LoginState } from '@/server/auth/actions';
import { Button } from '@/components/ui/button';

const initialState: LoginState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <form action={formAction} className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-xl font-extrabold tracking-tight">
          Padh<span className="text-violet-400">AI</span>
        </div>
        <p className="text-sm text-zinc-400">Sign in to your family dashboard.</p>
        <input
          name="email" type="email" required placeholder="Email"
          className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-violet-500"
        />
        <input
          name="password" type="password" required placeholder="Password"
          className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-violet-500"
        />
        {state.error && <p className="text-sm text-red-400">{state.error}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 7: Build the logout button component**

Create `padhai/src/components/auth/logout-button.tsx`:

```tsx
import { logoutAction } from '@/server/auth/actions';
import { Button } from '@/components/ui/button';

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <Button type="submit" variant="ghost" size="sm">Log out</Button>
    </form>
  );
}
```

- [ ] **Step 8: Protect the app shell + add logout**

Replace `padhai/src/app/(app)/layout.tsx` with:

```tsx
import { Sidebar } from '@/components/nav/sidebar';
import { BottomNav } from '@/components/nav/bottom-nav';
import { LogoutButton } from '@/components/auth/logout-button';
import { requireUser } from '@/server/auth/current-user';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3 md:px-8">
          <span className="text-sm text-zinc-400">{user.name}</span>
          <LogoutButton />
        </header>
        <main className="flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-8">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 9: Add "log out everywhere" to Settings**

Replace `padhai/src/app/(app)/settings/page.tsx` with:

```tsx
import { logoutEverywhereAction } from '@/server/auth/actions';
import { Button } from '@/components/ui/button';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <section className="space-y-3 rounded-xl border border-white/10 p-4">
        <h2 className="font-semibold">Security</h2>
        <p className="text-sm text-zinc-400">Sign out of every device where you are logged in.</p>
        <form action={logoutEverywhereAction}>
          <Button type="submit" variant="outline" size="sm">Log out everywhere</Button>
        </form>
      </section>
    </div>
  );
}
```

- [ ] **Step 10: Verify full suite + build**

```bash
cd padhai && npm test && npm run build
```

Expected: all suites pass; build compiles and lists `/login` plus the protected `(app)` routes. (The login page and actions are integration-glue over already-tested services; route-protection logic is covered by `current-user.test.ts`.)

- [ ] **Step 11: Manual route-protection acceptance**

```bash
cd padhai && npm run dev
```

- Visit `http://localhost:3000/` with no session cookie → you are redirected to `/login`.
- Create a user in another terminal: `cd padhai && DATABASE_URL=<your dev postgres url> npm run create-user -- --name "Ram" --email ram@example.com --password "supersecret"` (requires a running dev Postgres; skip if not set up locally and rely on the automated tests).
- Sign in → redirected to `/`; the header shows your name and a "Log out" button.
- Click "Log out" → back to `/login`; visiting `/` again redirects to `/login`.

Stop the server with Ctrl-C.

- [ ] **Step 12: Commit**

```bash
cd "g:/Projects/School Mission"
git add padhai/src/server/auth/current-user.ts padhai/src/server/auth/current-user.test.ts padhai/src/server/auth/actions.ts padhai/src/app/login padhai/src/components/auth padhai/src/app/(app)/layout.tsx padhai/src/app/(app)/settings/page.tsx
git commit -m "$(printf 'feat(m1): add login, route protection, logout and logout-everywhere\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## M1 Definition of Done

- [ ] `npm test` passes; new suites: password (4), session (8), rate-limit (4), users (4), authenticate (5), current-user (3), schema (2) — plus the M0 8 = 38 total.
- [ ] `npm run build` compiles; routes include `/login` and the protected `(app)` pages.
- [ ] Visiting a protected page without a valid session redirects to `/login`; after login it renders; logout and logout-everywhere both return to `/login`.
- [ ] DB stores only bcrypt password hashes and SHA-256 session-token hashes (verified by `session.test.ts` and `users.test.ts`).
- [ ] Cookie is httpOnly + SameSite=Lax + Secure-in-production (verified by reading `actions.ts cookieOptions`).
- [ ] Login is rate-limited per IP and per email (verified by `authenticate.test.ts`).
- [ ] No public signup or forgot-password route exists; first user only via `create-user` CLI.
- [ ] Security checklist (top of this plan) fully ticked.
- [ ] No `.env`/secrets tracked; `.env.example` placeholders only.

**STOP after M1.** Do not start M2 until M1 is reviewed, committed, (pushed if approved), and the user approves moving on.

---

# MILESTONE M2 · KIDS & GROUPS

> Begin only after M1 is approved.

## File Structure (M2)

```
padhai/src/
├── server/
│   ├── db/schema.ts                  # MODIFY: add kids + watched_groups
│   ├── kids/
│   │   ├── kids.ts                    # kids service (NEW)
│   │   └── kids.test.ts
│   └── groups/
│       ├── groups.ts                  # watched_groups service (NEW)
│       └── groups.test.ts
└── app/(app)/settings/
    ├── page.tsx                       # MODIFY: render Kids + Groups sections
    ├── kids-section.tsx               # Kids CRUD UI + actions (NEW)
    └── groups-section.tsx             # Groups CRUD UI + actions (NEW)
```

---

## Task M2.1: Kids + watched_groups schema and migration

**Files:**
- Modify: `padhai/src/server/db/schema.ts`
- Create (generated): a new migration under `padhai/drizzle/`
- Test: `padhai/src/server/db/kids-schema.test.ts`

**Interfaces:**
- Consumes: M1 schema patterns, `createTestDb`.
- Produces: Drizzle tables `kids` and `watchedGroups` (+ types `Kid`, `NewKid`, `WatchedGroup`).

- [ ] **Step 1: Append the tables to the schema**

Add to the end of `padhai/src/server/db/schema.ts`:

```ts
import { boolean } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { unique } from 'drizzle-orm/pg-core';

export const kids = pgTable('kids', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  grade: text('grade'),
  section: text('section'),
  schoolName: text('school_name'),
  avatarColor: text('avatar_color').notNull().default('#2563EB'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const watchedGroups = pgTable(
  'watched_groups',
  {
    id: serial('id').primaryKey(),
    kidId: integer('kid_id').notNull().references(() => kids.id, { onDelete: 'cascade' }),
    groupId: text('group_id'),               // nullable until the WhatsApp id is known
    groupName: text('group_name').notNull(), // display + fallback match key
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('watched_groups_kid_name_unique').on(t.kidId, t.groupName)],
);

export type Kid = typeof kids.$inferSelect;
export type NewKid = typeof kids.$inferInsert;
export type WatchedGroup = typeof watchedGroups.$inferSelect;
```

(Move the `boolean`, `unique` imports into the existing top `drizzle-orm/pg-core` import and drop the duplicate import lines; keep one import statement. The `sql` import is unused here — omit it if your linter flags it.)

- [ ] **Step 2: Generate the migration**

```bash
cd padhai && npx drizzle-kit generate --name kids_and_groups
```

Expected: a new SQL file (e.g. `0001_kids_and_groups.sql`) creating both tables.

- [ ] **Step 3: Write the failing schema test**

Create `padhai/src/server/db/kids-schema.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { createTestDb } from './test-db';
import { kids, watchedGroups } from './schema';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

describe('kids + watched_groups schema (PGlite)', () => {
  it('round-trips a kid with defaults', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    const [kid] = await ctx.db.insert(kids).values({ name: 'Aarav' }).returning();
    expect(kid.id).toBeGreaterThan(0);
    expect(kid.active).toBe(true);
    expect(kid.avatarColor).toBe('#2563EB');
  });

  it('links a watched group to a kid and enforces (kid, name) uniqueness', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    const [kid] = await ctx.db.insert(kids).values({ name: 'Diya' }).returning();
    await ctx.db.insert(watchedGroups).values({ kidId: kid.id, groupName: 'Class 3A' });
    await expect(
      ctx.db.insert(watchedGroups).values({ kidId: kid.id, groupName: 'Class 3A' }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 4: Run — verify GREEN**

```bash
cd padhai && npm test -- src/server/db/kids-schema.test.ts
```

Expected: PASS — `2 passed (2)`.

- [ ] **Step 5: Commit**

```bash
cd "g:/Projects/School Mission"
git add padhai/src/server/db/schema.ts padhai/src/server/db/kids-schema.test.ts padhai/drizzle
git commit -m "$(printf 'feat(m2): add kids and watched_groups schema\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task M2.2: Kids service (CRUD + validation)

**Files:**
- Create: `padhai/src/server/kids/kids.ts`, `padhai/src/server/kids/kids.test.ts`

**Interfaces:**
- Consumes: `Db`, `schema.kids`.
- Produces:
  - `createKid(db, input: { name; grade?; section?; schoolName?; avatarColor? }): Promise<Kid>` — zod-validated (name ≥ 1).
  - `listKids(db, opts?: { includeInactive?: boolean }): Promise<Kid[]>` — active only by default, ordered by id.
  - `getKid(db, id): Promise<Kid | null>`.
  - `updateKid(db, id, patch: Partial<{ name; grade; section; schoolName; avatarColor }>): Promise<Kid>`.
  - `setKidActive(db, id, active: boolean): Promise<Kid>` — soft delete via `active=false`.

- [ ] **Step 1: Write the failing test**

Create `padhai/src/server/kids/kids.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { createTestDb } from '../db/test-db';
import { createKid, listKids, getKid, updateKid, setKidActive } from './kids';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

describe('kids service (PGlite)', () => {
  it('creates and lists active kids', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    await createKid(ctx.db, { name: 'Aarav', grade: '5', section: 'B' });
    await createKid(ctx.db, { name: 'Diya', grade: '3' });
    const kids = await listKids(ctx.db);
    expect(kids.map((k) => k.name)).toEqual(['Aarav', 'Diya']);
  });

  it('rejects an empty name', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    await expect(createKid(ctx.db, { name: '' })).rejects.toThrow();
  });

  it('updates a kid', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    const kid = await createKid(ctx.db, { name: 'Aarav', grade: '5' });
    const updated = await updateKid(ctx.db, kid.id, { grade: '6', section: 'A' });
    expect(updated.grade).toBe('6');
    expect(updated.section).toBe('A');
  });

  it('soft-deletes a kid (excluded from active list, still fetchable)', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    const kid = await createKid(ctx.db, { name: 'Temp' });
    await setKidActive(ctx.db, kid.id, false);
    expect(await listKids(ctx.db)).toHaveLength(0);
    expect(await listKids(ctx.db, { includeInactive: true })).toHaveLength(1);
    expect((await getKid(ctx.db, kid.id))?.active).toBe(false);
  });
});
```

- [ ] **Step 2: Run — verify RED**

```bash
cd padhai && npm test -- src/server/kids/kids.test.ts
```

Expected: FAIL — `Failed to resolve import "./kids"`.

- [ ] **Step 3: Implement**

Create `padhai/src/server/kids/kids.ts`:

```ts
import { z } from 'zod';
import { and, eq, asc } from 'drizzle-orm';
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

void and; // (kept available for future compound filters)
```

(If your linter flags the unused `and` import, remove it and the `void and;` line.)

- [ ] **Step 4: Run — verify GREEN**

```bash
cd padhai && npm test -- src/server/kids/kids.test.ts
```

Expected: PASS — `4 passed (4)`.

- [ ] **Step 5: Commit**

```bash
cd "g:/Projects/School Mission"
git add padhai/src/server/kids
git commit -m "$(printf 'feat(m2): add kids CRUD service\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task M2.3: Watched-groups service (CRUD + validation, group_id/group_name)

**Files:**
- Create: `padhai/src/server/groups/groups.ts`, `padhai/src/server/groups/groups.test.ts`

**Interfaces:**
- Consumes: `Db`, `schema.watchedGroups`.
- Produces:
  - `addGroup(db, input: { kidId; groupName; groupId? }): Promise<WatchedGroup>` — zod-validated (groupName ≥ 1); if a row already exists for `(kidId, groupName)` it is reactivated (and `groupId` updated when supplied) instead of erroring.
  - `listGroupsForKid(db, kidId, opts?: { includeInactive?: boolean }): Promise<WatchedGroup[]>` — active only by default.
  - `setGroupActive(db, id, active: boolean): Promise<WatchedGroup>`.

- [ ] **Step 1: Write the failing test**

Create `padhai/src/server/groups/groups.test.ts`:

```ts
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
```

- [ ] **Step 2: Run — verify RED**

```bash
cd padhai && npm test -- src/server/groups/groups.test.ts
```

Expected: FAIL — `Failed to resolve import "./groups"`.

- [ ] **Step 3: Implement**

Create `padhai/src/server/groups/groups.ts`:

```ts
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
```

- [ ] **Step 4: Run — verify GREEN**

```bash
cd padhai && npm test -- src/server/groups/groups.test.ts
```

Expected: PASS — `4 passed (4)`.

- [ ] **Step 5: Commit**

```bash
cd "g:/Projects/School Mission"
git add padhai/src/server/groups
git commit -m "$(printf 'feat(m2): add watched-groups CRUD service\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task M2.4: Settings UI — Kids CRUD

**Files:**
- Create: `padhai/src/app/(app)/settings/kids-section.tsx`
- Modify: `padhai/src/app/(app)/settings/page.tsx` (render the Kids section)

**Interfaces:**
- Consumes: `requireUser` (M1.7), `getDb`, kids service (M2.2).
- Produces: a server component `KidsSection` that lists active kids and provides add/edit/deactivate via server actions. Route protection is inherited from the `(app)/layout.tsx` `requireUser()` guard (added in M1.7).

- [ ] **Step 1: Implement the Kids section with inline server actions**

Create `padhai/src/app/(app)/settings/kids-section.tsx`:

```tsx
import { revalidatePath } from 'next/cache';
import { getDb } from '@/server/db/client';
import { requireUser } from '@/server/auth/current-user';
import { createKid, listKids, setKidActive } from '@/server/kids/kids';
import { Button } from '@/components/ui/button';

async function addKid(formData: FormData) {
  'use server';
  await requireUser();
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return;
  await createKid(getDb(), {
    name,
    grade: String(formData.get('grade') ?? '') || undefined,
    section: String(formData.get('section') ?? '') || undefined,
  });
  revalidatePath('/settings');
}

async function deactivateKid(formData: FormData) {
  'use server';
  await requireUser();
  const id = Number(formData.get('id'));
  if (Number.isInteger(id)) {
    await setKidActive(getDb(), id, false);
    revalidatePath('/settings');
  }
}

export async function KidsSection() {
  const kids = await listKids(getDb());
  return (
    <section className="space-y-3 rounded-xl border border-white/10 p-4">
      <h2 className="font-semibold">Kids</h2>
      <ul className="space-y-2">
        {kids.length === 0 && <li className="text-sm text-zinc-400">No kids yet.</li>}
        {kids.map((kid) => (
          <li key={kid.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
            <span className="text-sm">
              <span className="font-medium">{kid.name}</span>
              {kid.grade && <span className="text-zinc-400"> · Grade {kid.grade}{kid.section ? `-${kid.section}` : ''}</span>}
            </span>
            <form action={deactivateKid}>
              <input type="hidden" name="id" value={kid.id} />
              <Button type="submit" variant="ghost" size="sm">Remove</Button>
            </form>
          </li>
        ))}
      </ul>
      <form action={addKid} className="flex flex-wrap gap-2">
        <input name="name" required placeholder="Name"
          className="flex-1 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-violet-500" />
        <input name="grade" placeholder="Grade"
          className="w-24 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-violet-500" />
        <input name="section" placeholder="Section"
          className="w-24 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-violet-500" />
        <Button type="submit" size="sm">Add kid</Button>
      </form>
    </section>
  );
}
```

- [ ] **Step 2: Render the Kids section in Settings**

Replace `padhai/src/app/(app)/settings/page.tsx` with:

```tsx
import { logoutEverywhereAction } from '@/server/auth/actions';
import { Button } from '@/components/ui/button';
import { KidsSection } from './kids-section';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <KidsSection />
      <section className="space-y-3 rounded-xl border border-white/10 p-4">
        <h2 className="font-semibold">Security</h2>
        <p className="text-sm text-zinc-400">Sign out of every device where you are logged in.</p>
        <form action={logoutEverywhereAction}>
          <Button type="submit" variant="outline" size="sm">Log out everywhere</Button>
        </form>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Verify suite + build**

```bash
cd padhai && npm test && npm run build
```

Expected: all suites pass; build compiles. (UI is glue over the tested kids service; the server actions call `requireUser()` so they are protected.)

- [ ] **Step 4: Commit**

```bash
cd "g:/Projects/School Mission"
git add padhai/src/app/(app)/settings/kids-section.tsx padhai/src/app/(app)/settings/page.tsx
git commit -m "$(printf 'feat(m2): add kids management UI in settings\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task M2.5: Settings UI — WhatsApp Groups CRUD per kid

**Files:**
- Create: `padhai/src/app/(app)/settings/groups-section.tsx`
- Modify: `padhai/src/app/(app)/settings/page.tsx` (render the Groups section)

**Interfaces:**
- Consumes: `requireUser`, `getDb`, kids service (`listKids`), groups service (M2.3).
- Produces: a server component `GroupsSection` listing each active kid with their watched groups and add/remove controls via server actions.

- [ ] **Step 1: Implement the Groups section**

Create `padhai/src/app/(app)/settings/groups-section.tsx`:

```tsx
import { revalidatePath } from 'next/cache';
import { getDb } from '@/server/db/client';
import { requireUser } from '@/server/auth/current-user';
import { listKids } from '@/server/kids/kids';
import { addGroup, listGroupsForKid, setGroupActive } from '@/server/groups/groups';
import { Button } from '@/components/ui/button';

async function addGroupAction(formData: FormData) {
  'use server';
  await requireUser();
  const kidId = Number(formData.get('kidId'));
  const groupName = String(formData.get('groupName') ?? '').trim();
  const groupId = String(formData.get('groupId') ?? '').trim() || undefined;
  if (Number.isInteger(kidId) && groupName) {
    await addGroup(getDb(), { kidId, groupName, groupId });
    revalidatePath('/settings');
  }
}

async function removeGroupAction(formData: FormData) {
  'use server';
  await requireUser();
  const id = Number(formData.get('id'));
  if (Number.isInteger(id)) {
    await setGroupActive(getDb(), id, false);
    revalidatePath('/settings');
  }
}

export async function GroupsSection() {
  const db = getDb();
  const kids = await listKids(db);
  const withGroups = await Promise.all(
    kids.map(async (kid) => ({ kid, groups: await listGroupsForKid(db, kid.id) })),
  );

  return (
    <section className="space-y-4 rounded-xl border border-white/10 p-4">
      <h2 className="font-semibold">WhatsApp Groups</h2>
      {withGroups.length === 0 && <p className="text-sm text-zinc-400">Add a kid first.</p>}
      {withGroups.map(({ kid, groups }) => (
        <div key={kid.id} className="space-y-2 rounded-lg bg-white/5 p-3">
          <div className="text-sm font-medium">{kid.name}</div>
          <ul className="space-y-1">
            {groups.length === 0 && <li className="text-xs text-zinc-400">No groups linked.</li>}
            {groups.map((g) => (
              <li key={g.id} className="flex items-center justify-between text-sm">
                <span>{g.groupName}{g.groupId ? <span className="text-zinc-500"> · {g.groupId}</span> : null}</span>
                <form action={removeGroupAction}>
                  <input type="hidden" name="id" value={g.id} />
                  <Button type="submit" variant="ghost" size="sm">Remove</Button>
                </form>
              </li>
            ))}
          </ul>
          <form action={addGroupAction} className="flex flex-wrap gap-2">
            <input type="hidden" name="kidId" value={kid.id} />
            <input name="groupName" required placeholder="Group name"
              className="flex-1 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-violet-500" />
            <input name="groupId" placeholder="Group id (optional)"
              className="w-44 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-violet-500" />
            <Button type="submit" size="sm">Add group</Button>
          </form>
        </div>
      ))}
    </section>
  );
}
```

- [ ] **Step 2: Render the Groups section in Settings**

Replace `padhai/src/app/(app)/settings/page.tsx` with:

```tsx
import { logoutEverywhereAction } from '@/server/auth/actions';
import { Button } from '@/components/ui/button';
import { KidsSection } from './kids-section';
import { GroupsSection } from './groups-section';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <KidsSection />
      <GroupsSection />
      <section className="space-y-3 rounded-xl border border-white/10 p-4">
        <h2 className="font-semibold">Security</h2>
        <p className="text-sm text-zinc-400">Sign out of every device where you are logged in.</p>
        <form action={logoutEverywhereAction}>
          <Button type="submit" variant="outline" size="sm">Log out everywhere</Button>
        </form>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Verify suite + build**

```bash
cd padhai && npm test && npm run build
```

Expected: all suites pass; build compiles.

- [ ] **Step 4: Manual acceptance (optional, needs dev Postgres)**

```bash
cd padhai && npm run dev
```

Log in, open `/settings`, add a kid, then add a WhatsApp group (name + optional id) to that kid, remove one, and confirm the lists update. Stop with Ctrl-C.

- [ ] **Step 5: Commit**

```bash
cd "g:/Projects/School Mission"
git add padhai/src/app/(app)/settings/groups-section.tsx padhai/src/app/(app)/settings/page.tsx
git commit -m "$(printf 'feat(m2): add whatsapp groups management UI in settings\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## M2 Definition of Done

- [ ] `npm test` passes; new suites: kids-schema (2), kids (4), groups (4) added on top of M1.
- [ ] `npm run build` compiles.
- [ ] Settings shows Kids and WhatsApp Groups sections; add/edit/remove work; soft-deleted kids/groups disappear from the active lists.
- [ ] `group_id` + `group_name` both stored; `group_id` optional; matching prefers `group_id`.
- [ ] Active/inactive handled via soft delete (no hard deletes).
- [ ] All settings server actions call `requireUser()`; protected access inherited from the `(app)` layout guard.
- [ ] No `.env`/secrets tracked.

---

## Self-Review Notes

- **Spec coverage — M1:** users schema (M1.1) ✓ · sessions schema (M1.1) ✓ · bcrypt (M1.2) ✓ · session token hashing/expiry/revoke (M1.3) ✓ · rate limiting (M1.4) ✓ · create-user CLI (M1.5) ✓ · authenticate (M1.6) ✓ · login page + httpOnly Secure SameSite cookie + session validation helper + route protection + logout + logout-everywhere (M1.7) ✓. Tests requested (password, session-token hashing, session expiry, rate limiting, CLI behavior, protected-route behavior) all present (CLI behavior is covered via its tested core `createUserAccount`; protected-route behavior via `resolveUserFromToken`).
- **Spec coverage — M2:** kids schema (M2.1) ✓ · watched_groups schema with group_id+group_name (M2.1) ✓ · kids CRUD (M2.2) ✓ · groups CRUD (M2.3) ✓ · active/inactive (M2.2/M2.3) ✓ · Settings integration (M2.4/M2.5) ✓ · validation (M2.2/M2.3) ✓ · CRUD/validation/protected-access tests ✓.
- **Placeholder scan:** every code step shows complete code; every command lists expected output; no TBD/TODO.
- **Type consistency:** `Db`, `User`, `Kid`, `WatchedGroup`, `AuthResult`, `RateLimiter`, `SESSION_COOKIE`, `SESSION_TTL_MS`, `resolveUserFromToken`, `createUserAccount`, `authenticate`, `createKid/listKids/setKidActive`, `addGroup/listGroupsForKid/setGroupActive` are used identically across tasks.
- **Decisions flagged for the user:** sliding renewal deferred (Decision 5); in-memory rate-limit store (Decision 6); `(kid, group_name)` uniqueness with nullable `group_id` (Decision 7).
```
