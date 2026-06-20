import { pgTable, serial, text, timestamp, integer, boolean, unique } from 'drizzle-orm/pg-core';

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
