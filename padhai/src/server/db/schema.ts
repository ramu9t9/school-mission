import { pgTable, serial, text, timestamp, integer, boolean, unique, pgEnum, numeric, date, time } from 'drizzle-orm/pg-core';

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
