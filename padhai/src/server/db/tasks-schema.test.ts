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
