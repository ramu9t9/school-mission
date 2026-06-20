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
