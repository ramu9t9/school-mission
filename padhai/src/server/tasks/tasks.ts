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
