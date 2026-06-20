import { describe, it, expect, afterEach } from 'vitest';
import { createTestDb } from '../db/test-db';
import type { Db } from '../db/client';
import { kids, users, tasks } from '../db/schema';
import { eq } from 'drizzle-orm';
import { createManualTask, listTasks, getTask } from './tasks';
import { updateTask, setBoardStatus, setPaymentStatus, deleteTask } from './tasks';

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
