# PadhAI — M3 (Tasks Core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the central `tasks` data model and a fully working **manual** task tracker — Add-Task screen, Home summary/timeline, Kanban board, and Task Detail/Edit (with fee fields) — all backed by real data and tested against in-memory Postgres. No AI yet.

**Architecture:** A `tasks` table (Drizzle pg enums + columns) with a pure, injected-`Db` service (`server/tasks`) holding all logic, unit-tested against PGlite. Thin Next.js server actions / server components wrap the service for the UI; every mutating action calls `requireUser()` and the whole `(app)` subtree is already guarded by the M1 layout. Manual tasks are created `source='manual'`, `review_status='confirmed'` so they show on the dashboard immediately.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript 5 (strict) · Tailwind 4 · shadcn/ui · Drizzle ORM 0.45 + drizzle-kit 0.31 · `postgres` 3.4 (runtime) · `@electric-sql/pglite` 0.5 (tests) · Vitest 4 · zod 4.

## Global Constraints

- **App root:** all code lives in `padhai/`. Never touch the gitignored legacy `digital-scout/`.
- **Single-tenant:** one family; NO `family_id` / tenant columns.
- **Single git repo** at `g:\Projects\School Mission`, branch `main`. No nested repo in `padhai/`.
- **Services take an injected `Db`** (dependency injection); use `import type { Db }` (type-only) so tests don't load `postgres.js`.
- **Tests run against PGlite** (in-memory) via the existing `createTestDb()` from `src/server/db/test-db.ts`. `npm test` is a hard gate. `vitest.config.ts` already sets `fileParallelism: false` + `testTimeout: 15000` — do NOT change it.
- **Dashboard query rule:** Home/Board show tasks where `review_status IN ('confirmed','auto_confirmed')`.
- **Route protection:** every mutating server action calls `await requireUser()` first; then the service; then `revalidatePath(...)`. The `(app)/layout.tsx` guard from M1 must stay untouched.
- **Soft delete only for kids/groups (M2).** Tasks support hard delete (a manual mistake should be removable); this is intentional and distinct.
- **Secrets:** `.env` never committed; `.env.example` placeholders only (keep `!.env.example` negation).
- **TDD:** for every logic unit (service, helpers, schema), write the failing test first, watch it fail, then implement. UI/server-action glue over tested services is verified by `npm run build` (+ optional manual with real Postgres).
- **Commits:** one per task, small; do NOT sign; end every message with:
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  ```
- **Do not push** unless the user explicitly asks.

---

## Risks & Decisions

1. **Tasks schema scope.** M3 creates `tasks` with content + workflow (`review_status`, `board_status`, `source`) + fee + reminder + audit-lite columns. All **enums are defined complete now** (Postgres can't easily add enum values later). The **pure-AI columns** (`confidence`, `ai_model`, `ai_extracted_json`, `raw_message_id`, `possible_duplicate_id`, `merged_into_id`) are **deferred to M5/M6** and added then as additive nullable columns (no backfill). This keeps M3 lean (YAGNI) while avoiding `ALTER TYPE` churn.
2. **Manual default = confirmed.** The column default for `review_status` is `'pending'` (the eventual AI common case), but `createManualTask` sets `'confirmed'` explicitly so manual tasks appear on the dashboard. Documented to avoid a footgun.
3. **Kanban without a DnD library.** Moves use server-action buttons (`Move →`). Simple and functional now; drag-drop is deferrable polish.
4. **Money as `numeric`.** `amount_due` is `numeric(10,2)`; Drizzle returns it as a **string** (e.g. `"4500.00"`). Tests compare with `Number(...)`. Currency default `'INR'`.
5. **Dates as strings.** `due_date`/`payment_due_date` are pg `date` → `'YYYY-MM-DD'` strings; `due_time` is pg `time` → `'HH:MM:SS'`; `reminder_at` is `timestamptz`. Relative-date resolution is the AI's job later — M3 takes explicit dates from the form.
6. **Timeline grouping is a pure, tested helper** (`timelineBucket`) so Home has a TDD core rather than untested glue.
7. **Seed needs real Postgres.** `scripts/seed.ts` runs against a live dev DB (not PGlite); it is not part of `npm test`.

## M4 matcher prerequisites (carried forward — NOT built in M3)
Recorded so the M4 plan budgets them: (1) add an index on `watched_groups.group_id`; (2) decide `group_name` normalization (trim/lowercase) + a normalized column/index + backfill before matching; (3) `group_id` is intentionally non-unique — the matcher must fan out to all rows for a `group_id`.

## Security Checklist (M3)
- [ ] Every mutating server action calls `requireUser()` before any DB work.
- [ ] No DB-touching code path reachable without the `(app)` layout guard.
- [ ] No secrets committed; `.env.example` placeholders only.
- [ ] No plaintext passwords / raw session tokens introduced (none in M3).

---

## File Structure (M3)

```
padhai/src/
├── server/
│   ├── db/schema.ts                 # MODIFY: add task enums + tasks table
│   └── tasks/
│       ├── tasks.ts                  # task service (NEW)
│       └── tasks.test.ts
├── lib/
│   ├── dates.ts                      # timelineBucket + todayISO helpers (NEW)
│   └── dates.test.ts
├── app/(app)/
│   ├── page.tsx                      # MODIFY: Home summary + timeline (real data)
│   ├── board/page.tsx                # MODIFY: Kanban (real data) + move actions
│   ├── home-filters.tsx              # filter chips (NEW)
│   └── task/
│       ├── new/page.tsx              # Add Manual Task screen (NEW)
│       ├── task-form.tsx             # shared client form (NEW)
│       └── [id]/page.tsx             # Task Detail/Edit (NEW)
└── scripts/seed.ts                   # demo data (NEW)
└── drizzle/0002_tasks_core.sql       # generated migration (NEW)
```

**Suggested execution batches** (separate commit per task within each):
- **Batch A — data + service:** M3.1, M3.2, M3.3
- **Batch B — UI:** M3.4, M3.5, M3.6, M3.7
- **Batch C — seed:** M3.8

---

## Task M3.1: Tasks schema, enums, and migration

**Files:**
- Modify: `padhai/src/server/db/schema.ts`
- Create (generated): `padhai/drizzle/0002_tasks_core.sql` (+ meta)
- Test: `padhai/src/server/db/tasks-schema.test.ts`

**Interfaces:**
- Consumes: existing `kids`, `users` tables.
- Produces: pg enums `taskTypeEnum`, `priorityEnum`, `reviewStatusEnum`, `boardStatusEnum`, `taskSourceEnum`, `paymentStatusEnum`, `reminderStatusEnum`; table `tasks`; types `Task`, `NewTask`.

- [ ] **Step 1: Add enums + the tasks table to the schema**

Append to `padhai/src/server/db/schema.ts` (and add `pgEnum`, `numeric`, `date`, `time`, `real` to the existing `drizzle-orm/pg-core` import — merge into the one import line, do not duplicate it):

```ts
import { pgEnum, numeric, date, time } from 'drizzle-orm/pg-core';

export const taskTypeEnum = pgEnum('task_type', [
  'homework', 'test', 'timetable', 'competition', 'event', 'fee', 'notice', 'other',
]);
export const priorityEnum = pgEnum('priority', ['high', 'medium', 'low']);
export const reviewStatusEnum = pgEnum('review_status', [
  'pending', 'confirmed', 'auto_confirmed', 'rejected', 'merged',
]);
export const boardStatusEnum = pgEnum('board_status', ['todo', 'doing', 'done']);
export const taskSourceEnum = pgEnum('task_source', ['ai', 'manual', 'imported']);
export const paymentStatusEnum = pgEnum('payment_status', [
  'unpaid', 'paid', 'partial', 'not_applicable',
]);
export const reminderStatusEnum = pgEnum('reminder_status', [
  'none', 'scheduled', 'sent', 'failed', 'snoozed',
]);

export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  kidId: integer('kid_id').notNull().references(() => kids.id, { onDelete: 'cascade' }),
  type: taskTypeEnum('type').notNull(),
  subject: text('subject'),
  title: text('title').notNull(),
  description: text('description'),
  dueDate: date('due_date'),
  dueTime: time('due_time'),
  priority: priorityEnum('priority').notNull().default('low'),
  reviewStatus: reviewStatusEnum('review_status').notNull().default('pending'),
  boardStatus: boardStatusEnum('board_status').notNull().default('todo'),
  source: taskSourceEnum('source').notNull().default('manual'),
  // Fee fields
  amountDue: numeric('amount_due', { precision: 10, scale: 2 }),
  currency: text('currency').notNull().default('INR'),
  paymentStatus: paymentStatusEnum('payment_status').notNull().default('not_applicable'),
  paymentDueDate: date('payment_due_date'),
  // Reminder fields
  reminderAt: timestamp('reminder_at', { withTimezone: true }),
  reminderStatus: reminderStatusEnum('reminder_status').notNull().default('none'),
  notified: boolean('notified').notNull().default(false),
  // Audit-lite
  confirmedBy: integer('confirmed_by').references(() => users.id),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  snoozedUntil: timestamp('snoozed_until', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
```

- [ ] **Step 2: Generate the migration**

```bash
cd padhai && npx drizzle-kit generate --name tasks_core
```

Expected: `padhai/drizzle/0002_tasks_core.sql` creating the seven enum types and the `tasks` table.

- [ ] **Step 3: Write the failing schema test**

Create `padhai/src/server/db/tasks-schema.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { createTestDb } from './test-db';
import { kids, tasks } from './schema';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

describe('tasks schema (PGlite)', () => {
  it('round-trips a task with defaults', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    const [kid] = await ctx.db.insert(kids).values({ name: 'Aarav' }).returning();
    const [task] = await ctx.db
      .insert(tasks)
      .values({ kidId: kid.id, type: 'homework', title: 'Maths Ch.5' })
      .returning();
    expect(task.id).toBeGreaterThan(0);
    expect(task.priority).toBe('low');
    expect(task.reviewStatus).toBe('pending');
    expect(task.boardStatus).toBe('todo');
    expect(task.source).toBe('manual');
    expect(task.currency).toBe('INR');
    expect(task.paymentStatus).toBe('not_applicable');
    expect(task.reminderStatus).toBe('none');
    expect(task.notified).toBe(false);
  });

  it('stores a fee task amount as a numeric string', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    const [kid] = await ctx.db.insert(kids).values({ name: 'Diya' }).returning();
    const [task] = await ctx.db
      .insert(tasks)
      .values({ kidId: kid.id, type: 'fee', title: 'Term fee', amountDue: '4500.00', paymentStatus: 'unpaid' })
      .returning();
    expect(Number(task.amountDue)).toBe(4500);
    expect(task.paymentStatus).toBe('unpaid');
  });
});
```

- [ ] **Step 4: Run the test — verify GREEN**

```bash
cd padhai && npm test -- src/server/db/tasks-schema.test.ts
```

Expected: PASS — `2 passed (2)`. (The migration from Step 2 makes this pass on first run.)

- [ ] **Step 5: Confirm the full suite + build**

```bash
cd padhai && npm test && npm run build
```

Expected: all suites pass (48 prior + 2 = 50); `✓ Compiled successfully`.

- [ ] **Step 6: Commit**

```bash
cd "g:/Projects/School Mission"
git add padhai/src/server/db/schema.ts padhai/src/server/db/tasks-schema.test.ts padhai/drizzle
git commit -m "$(printf 'feat(m3): add tasks schema, enums, and migration\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task M3.2: Task service — create (manual) + read (list with dashboard rule + filters) + get

**Files:**
- Create: `padhai/src/server/tasks/tasks.ts`, `padhai/src/server/tasks/tasks.test.ts`

**Interfaces:**
- Consumes: `Db`, `tasks` table, enums.
- Produces:
  - `type TaskType = 'homework'|'test'|'timetable'|'competition'|'event'|'fee'|'notice'|'other'`.
  - `type TaskFilters = { kidId?: number; type?: TaskType; boardStatus?: 'todo'|'doing'|'done'; priority?: 'high'|'medium'|'low'; includeAllStatuses?: boolean }`.
  - `createManualTask(db: Db, userId: number, input: CreateManualTaskInput): Promise<Task>` — validates with zod, sets `source='manual'`, `reviewStatus='confirmed'`, `boardStatus='todo'`, `confirmedBy=userId`, `confirmedAt=now`; for `type==='fee'` sets `paymentStatus='unpaid'` (else `'not_applicable'`).
  - `listTasks(db: Db, filters?: TaskFilters): Promise<Task[]>` — defaults to `reviewStatus IN ('confirmed','auto_confirmed')`; applies filters; orders by `due_date asc nulls last, created_at desc`.
  - `getTask(db: Db, id: number): Promise<Task | null>`.
  - `CreateManualTaskInput` = `{ kidId: number; type: TaskType; title: string; subject?: string; description?: string; dueDate?: string; dueTime?: string; priority?: 'high'|'medium'|'low'; amountDue?: number; currency?: string; paymentDueDate?: string; reminderAt?: string }`.

- [ ] **Step 1: Write the failing test**

Create `padhai/src/server/tasks/tasks.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { createTestDb } from '../db/test-db';
import type { Db } from '../db/client';
import { kids, users, tasks } from '../db/schema';
import { eq } from 'drizzle-orm';
import { createManualTask, listTasks, getTask } from './tasks';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

async function seed(db: Db): Promise<{ userId: number; kidId: number }> {
  const [u] = await db.insert(users).values({ name: 'Ram', email: 'ram@example.com', passwordHash: 'x' }).returning();
  const [k] = await db.insert(kids).values({ name: 'Aarav' }).returning();
  return { userId: u.id, kidId: k.id };
}

describe('createManualTask (PGlite)', () => {
  it('creates a confirmed manual task owned by the user', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    const { userId, kidId } = await seed(ctx.db);
    const task = await createManualTask(ctx.db, userId, { kidId, type: 'homework', title: 'Maths Ch.5', priority: 'medium' });
    expect(task.source).toBe('manual');
    expect(task.reviewStatus).toBe('confirmed');
    expect(task.boardStatus).toBe('todo');
    expect(task.confirmedBy).toBe(userId);
    expect(task.confirmedAt).not.toBeNull();
    expect(task.paymentStatus).toBe('not_applicable');
  });

  it('defaults a fee task to unpaid and stores the amount', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    const { userId, kidId } = await seed(ctx.db);
    const task = await createManualTask(ctx.db, userId, { kidId, type: 'fee', title: 'Term fee', amountDue: 4500, paymentDueDate: '2026-06-25' });
    expect(task.paymentStatus).toBe('unpaid');
    expect(Number(task.amountDue)).toBe(4500);
    expect(task.currency).toBe('INR');
    expect(task.paymentDueDate).toBe('2026-06-25');
  });

  it('rejects an empty title and an invalid type', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    const { userId, kidId } = await seed(ctx.db);
    await expect(createManualTask(ctx.db, userId, { kidId, type: 'homework', title: '' })).rejects.toThrow();
    // @ts-expect-error invalid type on purpose
    await expect(createManualTask(ctx.db, userId, { kidId, type: 'nope', title: 'x' })).rejects.toThrow();
  });
});

describe('listTasks (PGlite)', () => {
  it('returns only confirmed/auto_confirmed by default and applies filters', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    const { userId, kidId } = await seed(ctx.db);
    await createManualTask(ctx.db, userId, { kidId, type: 'homework', title: 'A' });
    await createManualTask(ctx.db, userId, { kidId, type: 'test', title: 'B' });
    // a pending task should be hidden from the default list
    await ctx.db.insert(tasks).values({ kidId, type: 'notice', title: 'pending', reviewStatus: 'pending' });

    const all = await listTasks(ctx.db);
    expect(all.map((t) => t.title).sort()).toEqual(['A', 'B']);

    const onlyTests = await listTasks(ctx.db, { type: 'test' });
    expect(onlyTests.map((t) => t.title)).toEqual(['B']);

    const includingPending = await listTasks(ctx.db, { includeAllStatuses: true });
    expect(includingPending).toHaveLength(3);
  });

  it('orders by due date ascending with nulls last', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    const { userId, kidId } = await seed(ctx.db);
    await createManualTask(ctx.db, userId, { kidId, type: 'homework', title: 'no-date' });
    await createManualTask(ctx.db, userId, { kidId, type: 'homework', title: 'later', dueDate: '2026-07-01' });
    await createManualTask(ctx.db, userId, { kidId, type: 'homework', title: 'soon', dueDate: '2026-06-21' });
    const list = await listTasks(ctx.db);
    expect(list.map((t) => t.title)).toEqual(['soon', 'later', 'no-date']);
  });
});

describe('getTask (PGlite)', () => {
  it('returns a task by id, or null', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    const { userId, kidId } = await seed(ctx.db);
    const created = await createManualTask(ctx.db, userId, { kidId, type: 'homework', title: 'A' });
    const found = await getTask(ctx.db, created.id);
    expect(found?.title).toBe('A');
    expect(await getTask(ctx.db, 99999)).toBeNull();
    void eq;
  });
});
```

- [ ] **Step 2: Run — verify RED**

```bash
cd padhai && npm test -- src/server/tasks/tasks.test.ts
```

Expected: FAIL — `Failed to resolve import "./tasks"`.

- [ ] **Step 3: Implement**

Create `padhai/src/server/tasks/tasks.ts`:

```ts
import { z } from 'zod';
import { and, eq, desc, inArray, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { tasks, type Task } from '../db/schema';

export type TaskType =
  | 'homework' | 'test' | 'timetable' | 'competition' | 'event' | 'fee' | 'notice' | 'other';

const TASK_TYPES = ['homework', 'test', 'timetable', 'competition', 'event', 'fee', 'notice', 'other'] as const;
const PRIORITIES = ['high', 'medium', 'low'] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

const createManualTaskSchema = z.object({
  kidId: z.number().int().positive(),
  type: z.enum(TASK_TYPES),
  title: z.string().min(1, 'Title is required'),
  subject: z.string().optional(),
  description: z.string().optional(),
  dueDate: z.string().regex(DATE_RE).optional(),
  dueTime: z.string().regex(TIME_RE).optional(),
  priority: z.enum(PRIORITIES).default('low'),
  amountDue: z.number().nonnegative().optional(),
  currency: z.string().default('INR'),
  paymentDueDate: z.string().regex(DATE_RE).optional(),
  reminderAt: z.string().optional(),
});

export type CreateManualTaskInput = z.input<typeof createManualTaskSchema>;

export interface TaskFilters {
  kidId?: number;
  type?: TaskType;
  boardStatus?: 'todo' | 'doing' | 'done';
  priority?: 'high' | 'medium' | 'low';
  includeAllStatuses?: boolean;
}

export async function createManualTask(
  db: Db,
  userId: number,
  input: CreateManualTaskInput,
): Promise<Task> {
  const v = createManualTaskSchema.parse(input);
  const now = new Date();
  const isFee = v.type === 'fee';
  const [task] = await db
    .insert(tasks)
    .values({
      kidId: v.kidId,
      type: v.type,
      title: v.title,
      subject: v.subject ?? null,
      description: v.description ?? null,
      dueDate: v.dueDate ?? null,
      dueTime: v.dueTime ?? null,
      priority: v.priority,
      reviewStatus: 'confirmed',
      boardStatus: 'todo',
      source: 'manual',
      amountDue: v.amountDue !== undefined ? String(v.amountDue) : null,
      currency: v.currency,
      paymentStatus: isFee ? 'unpaid' : 'not_applicable',
      paymentDueDate: v.paymentDueDate ?? null,
      reminderAt: v.reminderAt ? new Date(v.reminderAt) : null,
      confirmedBy: userId,
      confirmedAt: now,
    })
    .returning();
  return task;
}

export async function listTasks(db: Db, filters: TaskFilters = {}): Promise<Task[]> {
  const conds = [];
  if (!filters.includeAllStatuses) {
    conds.push(inArray(tasks.reviewStatus, ['confirmed', 'auto_confirmed']));
  }
  if (filters.kidId) conds.push(eq(tasks.kidId, filters.kidId));
  if (filters.type) conds.push(eq(tasks.type, filters.type));
  if (filters.boardStatus) conds.push(eq(tasks.boardStatus, filters.boardStatus));
  if (filters.priority) conds.push(eq(tasks.priority, filters.priority));
  return db
    .select()
    .from(tasks)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(sql`${tasks.dueDate} asc nulls last`, desc(tasks.createdAt));
}

export async function getTask(db: Db, id: number): Promise<Task | null> {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
  return task ?? null;
}
```

- [ ] **Step 4: Run — verify GREEN**

```bash
cd padhai && npm test -- src/server/tasks/tasks.test.ts
```

Expected: PASS — `6 passed (6)`.

- [ ] **Step 5: Commit**

```bash
cd "g:/Projects/School Mission"
git add padhai/src/server/tasks/tasks.ts padhai/src/server/tasks/tasks.test.ts
git commit -m "$(printf 'feat(m3): add task service create/list/get\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task M3.3: Task service — update, board-status transitions, payment status, delete

**Files:**
- Modify: `padhai/src/server/tasks/tasks.ts`, `padhai/src/server/tasks/tasks.test.ts`

**Interfaces:**
- Consumes: prior M3.2 service, `tasks` table.
- Produces:
  - `updateTask(db: Db, id: number, patch: UpdateTaskInput): Promise<Task>` — zod-validated partial of editable fields; sets `updated_at`; returns the updated row. No-op patch returns the existing row unchanged.
  - `setBoardStatus(db: Db, id: number, status: 'todo'|'doing'|'done'): Promise<Task>` — sets `board_status`; sets `completed_at=now` when `'done'`, clears it otherwise.
  - `setPaymentStatus(db: Db, id: number, status: 'unpaid'|'paid'|'partial'|'not_applicable'): Promise<Task>`.
  - `deleteTask(db: Db, id: number): Promise<void>`.
  - `UpdateTaskInput` = partial of `{ title; subject; description; type; priority; dueDate; dueTime; amountDue; paymentDueDate; reminderAt }`.

- [ ] **Step 1: Append the failing tests**

Append to `padhai/src/server/tasks/tasks.test.ts`:

```ts
import { updateTask, setBoardStatus, setPaymentStatus, deleteTask } from './tasks';

describe('task mutations (PGlite)', () => {
  it('updates editable fields and bumps updated_at', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    const { userId, kidId } = await seed(ctx.db);
    const task = await createManualTask(ctx.db, userId, { kidId, type: 'homework', title: 'A', priority: 'low' });
    const updated = await updateTask(ctx.db, task.id, { title: 'A (edited)', priority: 'high', dueDate: '2026-06-30' });
    expect(updated.title).toBe('A (edited)');
    expect(updated.priority).toBe('high');
    expect(updated.dueDate).toBe('2026-06-30');
  });

  it('returns the existing row unchanged for an empty patch', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    const { userId, kidId } = await seed(ctx.db);
    const task = await createManualTask(ctx.db, userId, { kidId, type: 'homework', title: 'A' });
    const same = await updateTask(ctx.db, task.id, {});
    expect(same.title).toBe('A');
  });

  it('moving to done sets completed_at; moving back clears it', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    const { userId, kidId } = await seed(ctx.db);
    const task = await createManualTask(ctx.db, userId, { kidId, type: 'homework', title: 'A' });
    const done = await setBoardStatus(ctx.db, task.id, 'done');
    expect(done.boardStatus).toBe('done');
    expect(done.completedAt).not.toBeNull();
    const reopened = await setBoardStatus(ctx.db, task.id, 'doing');
    expect(reopened.boardStatus).toBe('doing');
    expect(reopened.completedAt).toBeNull();
  });

  it('marks a fee task as paid', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    const { userId, kidId } = await seed(ctx.db);
    const fee = await createManualTask(ctx.db, userId, { kidId, type: 'fee', title: 'Fee', amountDue: 4500 });
    const paid = await setPaymentStatus(ctx.db, fee.id, 'paid');
    expect(paid.paymentStatus).toBe('paid');
  });

  it('deletes a task', async () => {
    const ctx = await createTestDb(); close = ctx.close;
    const { userId, kidId } = await seed(ctx.db);
    const task = await createManualTask(ctx.db, userId, { kidId, type: 'homework', title: 'A' });
    await deleteTask(ctx.db, task.id);
    expect(await getTask(ctx.db, task.id)).toBeNull();
  });
});
```

- [ ] **Step 2: Run — verify RED**

```bash
cd padhai && npm test -- src/server/tasks/tasks.test.ts
```

Expected: FAIL — `updateTask is not a function` (or import resolution error for the new names).

- [ ] **Step 3: Append the implementation**

Append to `padhai/src/server/tasks/tasks.ts`:

```ts
const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  subject: z.string().optional(),
  description: z.string().optional(),
  type: z.enum(TASK_TYPES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  dueDate: z.string().regex(DATE_RE).optional(),
  dueTime: z.string().regex(TIME_RE).optional(),
  amountDue: z.number().nonnegative().optional(),
  paymentDueDate: z.string().regex(DATE_RE).optional(),
  reminderAt: z.string().optional(),
});

export type UpdateTaskInput = z.input<typeof updateTaskSchema>;

export async function updateTask(db: Db, id: number, patch: UpdateTaskInput): Promise<Task> {
  const v = updateTaskSchema.parse(patch);
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (v.title !== undefined) set.title = v.title;
  if (v.subject !== undefined) set.subject = v.subject;
  if (v.description !== undefined) set.description = v.description;
  if (v.type !== undefined) set.type = v.type;
  if (v.priority !== undefined) set.priority = v.priority;
  if (v.dueDate !== undefined) set.dueDate = v.dueDate;
  if (v.dueTime !== undefined) set.dueTime = v.dueTime;
  if (v.amountDue !== undefined) set.amountDue = String(v.amountDue);
  if (v.paymentDueDate !== undefined) set.paymentDueDate = v.paymentDueDate;
  if (v.reminderAt !== undefined) set.reminderAt = v.reminderAt ? new Date(v.reminderAt) : null;

  if (Object.keys(set).length === 1) {
    const existing = await getTask(db, id);
    if (!existing) throw new Error('Task not found');
    return existing;
  }
  const [task] = await db.update(tasks).set(set).where(eq(tasks.id, id)).returning();
  return task;
}

export async function setBoardStatus(
  db: Db,
  id: number,
  status: 'todo' | 'doing' | 'done',
): Promise<Task> {
  const [task] = await db
    .update(tasks)
    .set({ boardStatus: status, completedAt: status === 'done' ? new Date() : null, updatedAt: new Date() })
    .where(eq(tasks.id, id))
    .returning();
  return task;
}

export async function setPaymentStatus(
  db: Db,
  id: number,
  status: 'unpaid' | 'paid' | 'partial' | 'not_applicable',
): Promise<Task> {
  const [task] = await db
    .update(tasks)
    .set({ paymentStatus: status, updatedAt: new Date() })
    .where(eq(tasks.id, id))
    .returning();
  return task;
}

export async function deleteTask(db: Db, id: number): Promise<void> {
  await db.delete(tasks).where(eq(tasks.id, id));
}
```

- [ ] **Step 4: Run — verify GREEN**

```bash
cd padhai && npm test -- src/server/tasks/tasks.test.ts
```

Expected: PASS — `11 passed (11)`.

- [ ] **Step 5: Commit**

```bash
cd "g:/Projects/School Mission"
git add padhai/src/server/tasks/tasks.ts padhai/src/server/tasks/tasks.test.ts
git commit -m "$(printf 'feat(m3): add task update, board-status, payment, delete\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task M3.4: Add Manual Task screen

**Files:**
- Create: `padhai/src/app/(app)/task/task-form.tsx`, `padhai/src/app/(app)/task/new/page.tsx`
- Modify: `padhai/src/app/(app)/page.tsx` (add an "Add Task" link — minimal, replaced fully in M3.5)

**Interfaces:**
- Consumes: `requireUser`, `getDb`, `createManualTask` (M3.2), `listKids` (M2).
- Produces: a `/task/new` route with a form that creates a manual task via a server action and redirects to `/`.

- [ ] **Step 1: Build the shared task form (client component)**

Create `padhai/src/app/(app)/task/task-form.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export interface KidOption { id: number; name: string }
export interface TaskFormValues {
  kidId?: number; type?: string; title?: string; subject?: string; description?: string;
  dueDate?: string; dueTime?: string; priority?: string; amountDue?: string; paymentDueDate?: string;
}

const TYPES = ['homework', 'test', 'timetable', 'competition', 'event', 'fee', 'notice', 'other'];
const inputCls = 'w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-violet-500';

export function TaskForm({
  kids, action, initial = {}, submitLabel, error,
}: {
  kids: KidOption[];
  action: (formData: FormData) => void;
  initial?: TaskFormValues;
  submitLabel: string;
  error?: string | null;
}) {
  const [type, setType] = useState(initial.type ?? 'homework');
  return (
    <form action={action} className="space-y-3">
      <select name="kidId" defaultValue={initial.kidId ?? ''} required className={inputCls}>
        <option value="" disabled>Select kid</option>
        {kids.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
      </select>
      <select name="type" value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
        {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <input name="title" required defaultValue={initial.title} placeholder="Title" className={inputCls} />
      <input name="subject" defaultValue={initial.subject} placeholder="Subject (optional)" className={inputCls} />
      <textarea name="description" defaultValue={initial.description} placeholder="Description (optional)" className={inputCls} />
      <div className="flex gap-2">
        <input type="date" name="dueDate" defaultValue={initial.dueDate} className={inputCls} />
        <input type="time" name="dueTime" defaultValue={initial.dueTime} className={inputCls} />
      </div>
      <select name="priority" defaultValue={initial.priority ?? 'low'} className={inputCls}>
        <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
      </select>
      {type === 'fee' && (
        <div className="flex gap-2">
          <input type="number" step="0.01" name="amountDue" defaultValue={initial.amountDue} placeholder="Amount (₹)" className={inputCls} />
          <input type="date" name="paymentDueDate" defaultValue={initial.paymentDueDate} className={inputCls} />
        </div>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
      <Button type="submit" className="w-full">{submitLabel}</Button>
    </form>
  );
}
```

- [ ] **Step 2: Build the new-task page + server action**

Create `padhai/src/app/(app)/task/new/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { getDb } from '@/server/db/client';
import { requireUser } from '@/server/auth/current-user';
import { listKids } from '@/server/kids/kids';
import { createManualTask, type TaskType } from '@/server/tasks/tasks';
import { TaskForm } from '../task-form';

async function createTaskAction(formData: FormData) {
  'use server';
  const user = await requireUser();
  const kidId = Number(formData.get('kidId'));
  const title = String(formData.get('title') ?? '').trim();
  if (!Number.isInteger(kidId) || !title) return;
  const amountRaw = String(formData.get('amountDue') ?? '');
  await createManualTask(getDb(), user.id, {
    kidId,
    type: String(formData.get('type') ?? 'other') as TaskType,
    title,
    subject: String(formData.get('subject') ?? '') || undefined,
    description: String(formData.get('description') ?? '') || undefined,
    dueDate: String(formData.get('dueDate') ?? '') || undefined,
    dueTime: String(formData.get('dueTime') ?? '') || undefined,
    priority: (String(formData.get('priority') ?? 'low') as 'high' | 'medium' | 'low'),
    amountDue: amountRaw ? Number(amountRaw) : undefined,
    paymentDueDate: String(formData.get('paymentDueDate') ?? '') || undefined,
  });
  redirect('/');
}

export default async function NewTaskPage() {
  await requireUser();
  const kids = await listKids(getDb());
  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-bold">Add Task</h1>
      <TaskForm kids={kids.map((k) => ({ id: k.id, name: k.name }))} action={createTaskAction} submitLabel="Add task" />
    </div>
  );
}
```

- [ ] **Step 3: Add a temporary "Add Task" link on Home**

Replace `padhai/src/app/(app)/page.tsx` with:

```tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Home</h1>
      <Link href="/task/new"><Button>＋ Add Task</Button></Link>
    </div>
  );
}
```

- [ ] **Step 4: Verify suite + build**

```bash
cd padhai && npm test && npm run build
```

Expected: tests pass (50); build compiles and lists `/task/new`.

- [ ] **Step 5: Commit**

```bash
cd "g:/Projects/School Mission"
git add padhai/src/app/(app)/task/task-form.tsx padhai/src/app/(app)/task/new/page.tsx padhai/src/app/(app)/page.tsx
git commit -m "$(printf 'feat(m3): add manual task creation screen\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task M3.5: Home — summary tiles + timeline (real data) + filters

**Files:**
- Create: `padhai/src/lib/dates.ts`, `padhai/src/lib/dates.test.ts`, `padhai/src/app/(app)/home-filters.tsx`
- Modify: `padhai/src/app/(app)/page.tsx`

**Interfaces:**
- Consumes: `listTasks`/`TaskFilters` (M3.2), `listKids` (M2), `requireUser`, `getDb`.
- Produces:
  - `todayISO(now?: Date): string` — `'YYYY-MM-DD'` for the current date (UTC date part; good enough for v1).
  - `timelineBucket(dueDate: string | null, today: string): 'overdue'|'today'|'tomorrow'|'week'|'later'|'none'` — pure date-bucketer.
  - A Home page that reads `searchParams` (`kid`, `type`, `priority`), lists confirmed tasks, renders stat tiles + a grouped timeline + filter chips.

- [ ] **Step 1: Write the failing helper test**

Create `padhai/src/lib/dates.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { timelineBucket, todayISO } from './dates';

describe('todayISO', () => {
  it('formats the date part as YYYY-MM-DD', () => {
    expect(todayISO(new Date('2026-06-20T09:30:00Z'))).toBe('2026-06-20');
  });
});

describe('timelineBucket', () => {
  const today = '2026-06-20';
  it('buckets by relative day', () => {
    expect(timelineBucket(null, today)).toBe('none');
    expect(timelineBucket('2026-06-19', today)).toBe('overdue');
    expect(timelineBucket('2026-06-20', today)).toBe('today');
    expect(timelineBucket('2026-06-21', today)).toBe('tomorrow');
    expect(timelineBucket('2026-06-25', today)).toBe('week');   // within 7 days
    expect(timelineBucket('2026-08-01', today)).toBe('later');
  });
});
```

- [ ] **Step 2: Run — verify RED**

```bash
cd padhai && npm test -- src/lib/dates.test.ts
```

Expected: FAIL — `Failed to resolve import "./dates"`.

- [ ] **Step 3: Implement the helpers**

Create `padhai/src/lib/dates.ts`:

```ts
export function todayISO(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export type TimelineBucket = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'none';

export function timelineBucket(dueDate: string | null, today: string): TimelineBucket {
  if (!dueDate) return 'none';
  const due = Date.parse(`${dueDate}T00:00:00Z`);
  const ref = Date.parse(`${today}T00:00:00Z`);
  const days = Math.round((due - ref) / 86_400_000);
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days <= 7) return 'week';
  return 'later';
}
```

- [ ] **Step 4: Run — verify GREEN**

```bash
cd padhai && npm test -- src/lib/dates.test.ts
```

Expected: PASS — `2 passed (2)`.

- [ ] **Step 5: Build the filter chips component**

Create `padhai/src/app/(app)/home-filters.tsx`:

```tsx
import Link from 'next/link';

export interface KidChip { id: number; name: string }
const TYPES = ['homework', 'test', 'timetable', 'competition', 'event', 'fee', 'notice', 'other'];

function chipCls(active: boolean) {
  return `rounded-full border px-3 py-1 text-xs ${active ? 'border-violet-500 bg-violet-500/20 text-violet-200' : 'border-white/10 text-zinc-400'}`;
}

export function HomeFilters({ kids, kid, type }: { kids: KidChip[]; kid?: string; type?: string }) {
  const q = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { kid, type, ...next };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const s = params.toString();
    return s ? `/?${s}` : '/';
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Link href={q({ kid: undefined })} className={chipCls(!kid)}>All kids</Link>
        {kids.map((k) => (
          <Link key={k.id} href={q({ kid: String(k.id) })} className={chipCls(kid === String(k.id))}>{k.name}</Link>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={q({ type: undefined })} className={chipCls(!type)}>All types</Link>
        {TYPES.map((t) => (
          <Link key={t} href={q({ type: t })} className={chipCls(type === t)}>{t}</Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Rebuild the Home page with real data**

Replace `padhai/src/app/(app)/page.tsx` with:

```tsx
import Link from 'next/link';
import { getDb } from '@/server/db/client';
import { requireUser } from '@/server/auth/current-user';
import { listKids } from '@/server/kids/kids';
import { listTasks, type TaskType } from '@/server/tasks/tasks';
import { todayISO, timelineBucket, type TimelineBucket } from '@/lib/dates';
import { Button } from '@/components/ui/button';
import { HomeFilters } from './home-filters';

const GROUP_ORDER: { key: TimelineBucket; label: string }[] = [
  { key: 'overdue', label: '⚠️ Overdue' },
  { key: 'today', label: '⏰ Today' },
  { key: 'tomorrow', label: '📅 Tomorrow' },
  { key: 'week', label: '🗓️ This week' },
  { key: 'later', label: 'Later' },
  { key: 'none', label: 'No date' },
];

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser();
  const sp = await searchParams;
  const db = getDb();
  const kids = await listKids(db);
  const tasks = await listTasks(db, {
    kidId: sp.kid ? Number(sp.kid) : undefined,
    type: sp.type as TaskType | undefined,
  });
  const today = todayISO();

  const dueToday = tasks.filter((t) => timelineBucket(t.dueDate, today) === 'today').length;
  const exams = tasks.filter((t) => t.type === 'test').length;
  const feesDue = tasks.filter((t) => t.type === 'fee' && (t.paymentStatus === 'unpaid' || t.paymentStatus === 'partial'))
    .reduce((sum, t) => sum + Number(t.amountDue ?? 0), 0);

  const groups = GROUP_ORDER.map((g) => ({ ...g, items: tasks.filter((t) => timelineBucket(t.dueDate, today) === g.key) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Home</h1>
        <Link href="/task/new"><Button size="sm">＋ Add Task</Button></Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/10 p-3"><div className="text-2xl font-bold text-violet-300">{dueToday}</div><div className="text-xs text-zinc-400">Due today</div></div>
        <div className="rounded-xl border border-white/10 p-3"><div className="text-2xl font-bold text-cyan-300">{exams}</div><div className="text-xs text-zinc-400">Exams</div></div>
        <div className="rounded-xl border border-white/10 p-3"><div className="text-2xl font-bold text-pink-300">₹{feesDue.toLocaleString('en-IN')}</div><div className="text-xs text-zinc-400">Fees due</div></div>
      </div>

      <HomeFilters kids={kids.map((k) => ({ id: k.id, name: k.name }))} kid={sp.kid} type={sp.type} />

      {groups.length === 0 && <p className="text-sm text-zinc-400">No tasks yet. Add one to get started.</p>}
      {groups.map((g) => (
        <section key={g.key} className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{g.label}</h2>
          {g.items.map((t) => (
            <Link key={t.id} href={`/task/${t.id}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <span className="text-sm"><span className="font-medium">{t.title}</span><span className="text-zinc-500"> · {t.type}</span></span>
              <span className="text-xs text-zinc-400">{t.dueDate ?? ''}{t.priority === 'high' ? ' · 🔴' : ''}</span>
            </Link>
          ))}
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 7: Verify suite + build**

```bash
cd padhai && npm test && npm run build
```

Expected: tests pass (52); build compiles.

- [ ] **Step 8: Commit**

```bash
cd "g:/Projects/School Mission"
git add padhai/src/lib/dates.ts padhai/src/lib/dates.test.ts padhai/src/app/(app)/home-filters.tsx padhai/src/app/(app)/page.tsx
git commit -m "$(printf 'feat(m3): build Home summary and timeline on real tasks\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task M3.6: Board (Kanban) on real data + move actions + filters

**Files:**
- Modify: `padhai/src/app/(app)/board/page.tsx`

**Interfaces:**
- Consumes: `listTasks` (M3.2), `setBoardStatus` (M3.3), `listKids`, `requireUser`, `getDb`.
- Produces: a Board page with three columns (To Do / Doing / Done), per-card move buttons (server actions), and a kid filter via `searchParams`.

- [ ] **Step 1: Rebuild the Board page**

Replace `padhai/src/app/(app)/board/page.tsx` with:

```tsx
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { getDb } from '@/server/db/client';
import { requireUser } from '@/server/auth/current-user';
import { listKids } from '@/server/kids/kids';
import { listTasks, setBoardStatus } from '@/server/tasks/tasks';
import { Button } from '@/components/ui/button';

async function moveAction(formData: FormData) {
  'use server';
  await requireUser();
  const id = Number(formData.get('id'));
  const status = String(formData.get('status')) as 'todo' | 'doing' | 'done';
  if (Number.isInteger(id) && ['todo', 'doing', 'done'].includes(status)) {
    await setBoardStatus(getDb(), id, status);
    revalidatePath('/board');
  }
}

const COLUMNS: { key: 'todo' | 'doing' | 'done'; label: string; next?: 'doing' | 'done'; prev?: 'todo' | 'doing' }[] = [
  { key: 'todo', label: 'To Do', next: 'doing' },
  { key: 'doing', label: 'Doing', next: 'done', prev: 'todo' },
  { key: 'done', label: 'Done', prev: 'doing' },
];

export default async function BoardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser();
  const sp = await searchParams;
  const db = getDb();
  const kids = await listKids(db);
  const kidId = sp.kid ? Number(sp.kid) : undefined;
  const tasks = await listTasks(db, { kidId });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Board</h1>
      <div className="flex flex-wrap gap-2">
        <Link href="/board" className={`rounded-full border px-3 py-1 text-xs ${!kidId ? 'border-violet-500 text-violet-200' : 'border-white/10 text-zinc-400'}`}>All kids</Link>
        {kids.map((k) => (
          <Link key={k.id} href={`/board?kid=${k.id}`} className={`rounded-full border px-3 py-1 text-xs ${kidId === k.id ? 'border-violet-500 text-violet-200' : 'border-white/10 text-zinc-400'}`}>{k.name}</Link>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const items = tasks.filter((t) => t.boardStatus === col.key);
          return (
            <div key={col.key} className="space-y-2 rounded-xl border border-white/10 p-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{col.label} ({items.length})</h2>
              {items.map((t) => (
                <div key={t.id} className="rounded-lg bg-white/5 p-2">
                  <Link href={`/task/${t.id}`} className="text-sm font-medium">{t.title}</Link>
                  <div className="mt-1 flex gap-1">
                    {col.prev && (
                      <form action={moveAction}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="status" value={col.prev} /><Button type="submit" variant="ghost" size="sm">←</Button></form>
                    )}
                    {col.next && (
                      <form action={moveAction}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="status" value={col.next} /><Button type="submit" variant="ghost" size="sm">→</Button></form>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify suite + build**

```bash
cd padhai && npm test && npm run build
```

Expected: tests pass (52); build compiles.

- [ ] **Step 3: Commit**

```bash
cd "g:/Projects/School Mission"
git add padhai/src/app/(app)/board/page.tsx
git commit -m "$(printf 'feat(m3): build Kanban board on real tasks with move actions\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task M3.7: Task Detail / Edit screen (with fee mark-as-paid + delete)

**Files:**
- Create: `padhai/src/app/(app)/task/[id]/page.tsx`

**Interfaces:**
- Consumes: `getTask`, `updateTask`, `setPaymentStatus`, `deleteTask` (M3.2/M3.3), `listKids`, `requireUser`, `getDb`, `TaskForm` (M3.4).
- Produces: a `/task/[id]` route showing/editing a task, marking a fee paid, and deleting.

- [ ] **Step 1: Build the detail/edit page**

Create `padhai/src/app/(app)/task/[id]/page.tsx`:

```tsx
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getDb } from '@/server/db/client';
import { requireUser } from '@/server/auth/current-user';
import { listKids } from '@/server/kids/kids';
import { getTask, updateTask, setPaymentStatus, deleteTask, type TaskType } from '@/server/tasks/tasks';
import { TaskForm } from '../task-form';
import { Button } from '@/components/ui/button';

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id: idStr } = await params;
  const id = Number(idStr);
  const db = getDb();
  const task = await getTask(db, id);
  if (!task) notFound();
  const kids = await listKids(db);

  async function saveAction(formData: FormData) {
    'use server';
    await requireUser();
    const title = String(formData.get('title') ?? '').trim();
    if (!title) return;
    const amountRaw = String(formData.get('amountDue') ?? '');
    await updateTask(getDb(), id, {
      title,
      type: String(formData.get('type') ?? 'other') as TaskType,
      subject: String(formData.get('subject') ?? '') || undefined,
      description: String(formData.get('description') ?? '') || undefined,
      dueDate: String(formData.get('dueDate') ?? '') || undefined,
      dueTime: String(formData.get('dueTime') ?? '') || undefined,
      priority: String(formData.get('priority') ?? 'low') as 'high' | 'medium' | 'low',
      amountDue: amountRaw ? Number(amountRaw) : undefined,
      paymentDueDate: String(formData.get('paymentDueDate') ?? '') || undefined,
    });
    revalidatePath(`/task/${id}`);
    redirect(`/task/${id}`);
  }

  async function markPaidAction() {
    'use server';
    await requireUser();
    await setPaymentStatus(getDb(), id, 'paid');
    revalidatePath(`/task/${id}`);
  }

  async function deleteAction() {
    'use server';
    await requireUser();
    await deleteTask(getDb(), id);
    redirect('/');
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <h1 className="text-2xl font-bold">Edit task</h1>

      {task.type === 'fee' && (
        <section className="space-y-2 rounded-xl border border-pink-500/30 bg-pink-500/10 p-3">
          <div className="text-sm">₹{Number(task.amountDue ?? 0).toLocaleString('en-IN')} · {task.paymentStatus}{task.paymentDueDate ? ` · due ${task.paymentDueDate}` : ''}</div>
          {task.paymentStatus !== 'paid' && (
            <form action={markPaidAction}><Button type="submit" size="sm">Mark as paid</Button></form>
          )}
        </section>
      )}

      <TaskForm
        kids={kids.map((k) => ({ id: k.id, name: k.name }))}
        action={saveAction}
        submitLabel="Save changes"
        initial={{
          kidId: task.kidId, type: task.type, title: task.title, subject: task.subject ?? undefined,
          description: task.description ?? undefined, dueDate: task.dueDate ?? undefined, dueTime: task.dueTime?.slice(0, 5) ?? undefined,
          priority: task.priority, amountDue: task.amountDue ?? undefined, paymentDueDate: task.paymentDueDate ?? undefined,
        }}
      />

      <form action={deleteAction}><Button type="submit" variant="ghost" size="sm" className="text-red-400">Delete task</Button></form>
    </div>
  );
}
```

(Note: the kid `<select>` in `TaskForm` is display-only here — M3 edits don't reassign the kid; that's fine for v1, and `updateTask` doesn't accept `kidId`.)

- [ ] **Step 2: Verify suite + build**

```bash
cd padhai && npm test && npm run build
```

Expected: tests pass (52); build compiles and lists `/task/[id]`.

- [ ] **Step 3: Commit**

```bash
cd "g:/Projects/School Mission"
git add padhai/src/app/(app)/task/[id]/page.tsx
git commit -m "$(printf 'feat(m3): add task detail/edit screen with fee mark-as-paid\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task M3.8: Seed / demo data script

**Files:**
- Create: `padhai/src/scripts/seed.ts`
- Modify: `padhai/package.json` (add a `seed` script)

**Interfaces:**
- Consumes: `getDb`, `createUserAccount` (M1.5), kids/groups services (M2), `createManualTask` (M3.2).
- Produces: a `npm run seed` command that populates a dev Postgres with demo data. (Runs against a live DB; NOT part of `npm test`.)

- [ ] **Step 1: Write the seed script**

Create `padhai/src/scripts/seed.ts`:

```ts
import { getDb } from '../server/db/client';
import { getUserByEmail, createUserAccount } from '../server/auth/users';
import { createKid } from '../server/kids/kids';
import { addGroup } from '../server/groups/groups';
import { createManualTask } from '../server/tasks/tasks';

async function main() {
  const db = getDb();

  let user = await getUserByEmail(db, 'demo@padhai.app');
  if (!user) user = await createUserAccount(db, { name: 'Demo Parent', email: 'demo@padhai.app', password: 'demo-password' });

  const aarav = await createKid(db, { name: 'Aarav', grade: '5', section: 'B' });
  const diya = await createKid(db, { name: 'Diya', grade: '3', section: 'A' });

  await addGroup(db, { kidId: aarav.id, groupName: 'Class 5B Parents' });
  await addGroup(db, { kidId: diya.id, groupName: 'Class 3A Official' });

  const tasks = [
    { kidId: aarav.id, type: 'homework' as const, title: 'Maths exercise 5.2 Q1–10', priority: 'medium' as const, dueDate: isoIn(1) },
    { kidId: aarav.id, type: 'test' as const, title: 'Science unit test — Ch. 4 & 5', priority: 'high' as const, dueDate: isoIn(0) },
    { kidId: diya.id, type: 'homework' as const, title: 'English worksheet pages 12–14', priority: 'medium' as const, dueDate: isoIn(0) },
    { kidId: aarav.id, type: 'competition' as const, title: 'Inter-school Olympiad — register', priority: 'high' as const, dueDate: isoIn(4) },
    { kidId: diya.id, type: 'fee' as const, title: 'Term fee', amountDue: 4500, paymentDueDate: isoIn(5) },
    { kidId: diya.id, type: 'notice' as const, title: 'PTM on Saturday', priority: 'low' as const, dueDate: isoIn(6) },
  ];
  const created = [];
  for (const t of tasks) created.push(await createManualTask(db, user.id, t));

  // Mark one as done so the Board has a Done column populated.
  const { setBoardStatus } = await import('../server/tasks/tasks');
  await setBoardStatus(db, created[2].id, 'done');

  console.log(`Seeded: user #${user.id}, kids #${aarav.id}/#${diya.id}, ${created.length} tasks.`);
  process.exit(0);
}

function isoIn(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

main().catch((err) => { console.error('Seed failed:', err instanceof Error ? err.message : err); process.exit(1); });
```

- [ ] **Step 2: Add the npm script**

In `padhai/package.json` add to `scripts`:

```json
    "seed": "tsx src/scripts/seed.ts"
```

- [ ] **Step 3: Verify suite + build (seed runs only against real DB, not tested here)**

```bash
cd padhai && npm test && npm run build
```

Expected: tests still pass (52); build compiles. (Do NOT run `npm run seed` unless a dev Postgres + `DATABASE_URL` is configured; it is a manual tool.)

- [ ] **Step 4: Commit**

```bash
cd "g:/Projects/School Mission"
git add padhai/src/scripts/seed.ts padhai/package.json
git commit -m "$(printf 'feat(m3): add demo data seed script\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## M3 Definition of Done

- [ ] `npm test` passes; new suites: tasks-schema (2), tasks service (11), dates (2) = +15 → 63 total.
- [ ] `npm run build` compiles; routes include `/task/new`, `/task/[id]`, and the rebuilt `/` and `/board`.
- [ ] Add Manual Task creates a task (type-driven fee fields) and it appears on Home.
- [ ] Home shows stat tiles (due today / exams / fees due ₹) and a timeline grouped Overdue/Today/Tomorrow/This week/Later/No date, with kid + type filters.
- [ ] Board shows To Do / Doing / Done with working move buttons; moving to Done sets `completed_at`.
- [ ] Task Detail edits fields, marks a fee paid, and deletes.
- [ ] Fee fields (amount/currency/payment status/payment due) and reminder fields exist in the model; fee UX (amount + mark-as-paid) works.
- [ ] Seed script exists (`npm run seed`) for a dev Postgres.
- [ ] Every mutating server action calls `requireUser()`; route protection intact; no `.env`/secrets tracked.

**Manual browser verification** needs a dev Postgres; if unavailable, automated tests + build are the gates (state which in the report). Login/create/seed against real Postgres before deployment.

---

## Self-Review Notes

- **Spec coverage:** tasks schema+migration (M3.1) ✓ · enums/types (M3.1) ✓ · manual task service (M3.2/M3.3) ✓ · Add Manual Task screen (M3.4) ✓ · Home summary/timeline real data (M3.5) ✓ · Board real data (M3.6) ✓ · filters kid/type/status/priority (M3.5 home: kid+type; M3.6 board: kid; service supports status+priority) ✓ · Task Detail/Edit (M3.7) ✓ · fee fields in model + UX (M3.1/M3.2/M3.7) ✓ · reminder fields in model (M3.1; editable via `reminderAt` in update) ✓ · seed/demo data (M3.8) ✓ · tests for service/validation/status-transitions/fee/board-status (M3.2/M3.3) ✓.
- **Placeholder scan:** every code step has complete code; every command has expected output; no TBD/TODO.
- **Type consistency:** `Task`, `TaskType`, `TaskFilters`, `CreateManualTaskInput`, `UpdateTaskInput`, `createManualTask/listTasks/getTask/updateTask/setBoardStatus/setPaymentStatus/deleteTask`, `timelineBucket/todayISO` are used identically across tasks.
- **Deferred (documented):** AI columns to M5/M6; `merged_into_id`/`possible_duplicate_id`/`raw_message_id` not added in M3; priority filter on Home and status filter wired in the service but Home UI exposes kid+type chips (board exposes kid) — extra filters are query-param ready without more UI.
```
