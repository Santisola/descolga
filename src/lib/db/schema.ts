import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const notifyMode = pgEnum('notify_mode', ['once', 'persistent', 'insist'])
export const reminderStatus = pgEnum('reminder_status', ['pending', 'done', 'snoozed', 'archived'])

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  /** IANA zone. Quiet hours and "hoy / mañana" are resolved in this zone. */
  timezone: text('timezone').notNull().default('America/Argentina/Buenos_Aires'),
  /** Minutes from local midnight. 23:00 -> 1380, 08:00 -> 480. */
  quietStartMinutes: smallint('quiet_start_minutes').notNull().default(1380),
  quietEndMinutes: smallint('quiet_end_minutes').notNull().default(480),
  /** Defaults copied onto new reminders created with insist on. */
  defaultInsistIntervalMinutes: integer('default_insist_interval_minutes').notNull().default(60),
  defaultMaxRepeats: integer('default_max_repeats').notNull().default(5),
  /** Show what's overdue in-app on open, for users who denied notifications. */
  reviewOnOpen: boolean('review_on_open').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('users_email_unique').on(t.email)])

export const reminders = pgTable('reminders', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  title: text('title').notNull(),
  notes: text('notes'),

  /** Deadline shown to the user. */
  dueAt: timestamp('due_at', { withTimezone: true }),
  /** When the first push should fire. Defaults to dueAt on write. */
  notifyAt: timestamp('notify_at', { withTimezone: true }),

  notifyMode: notifyMode('notify_mode').notNull().default('once'),
  insistIntervalMinutes: integer('insist_interval_minutes').notNull().default(60),
  maxRepeats: integer('max_repeats').notNull().default(5),

  status: reminderStatus('status').notNull().default('pending'),
  snoozedUntil: timestamp('snoozed_until', { withTimezone: true }),

  /** Recurrence is relative to completion: next = completedAt + intervalDays. */
  recurrenceIntervalDays: integer('recurrence_interval_days'),

  /** Pushes sent for the current pending cycle. Reset when it recurs. */
  sentCount: integer('sent_count').notNull().default(0),
  lastNotifiedAt: timestamp('last_notified_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (t) => [
  index('reminders_user_status_idx').on(t.userId, t.status),
  // The scheduler's hot path: pending rows ordered by when they may fire next.
  index('reminders_due_idx').on(t.status, t.notifyAt),
])

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  deviceLabel: text('device_label').notNull().default('Dispositivo'),
  /** Set when the push service answers 404/410. Kept for the Ajustes list. */
  expiredAt: timestamp('expired_at', { withTimezone: true }),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('push_subscriptions_endpoint_unique').on(t.endpoint)])

export const notificationLog = pgTable('notification_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  reminderId: uuid('reminder_id').notNull().references(() => reminders.id, { onDelete: 'cascade' }),
  subscriptionId: uuid('subscription_id').references(() => pushSubscriptions.id, { onDelete: 'set null' }),
  /** Which repeat this was: 1 = first push of the cycle. */
  attempt: integer('attempt').notNull().default(1),
  ok: boolean('ok').notNull().default(true),
  detail: text('detail'),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('notification_log_reminder_idx').on(t.reminderId, t.sentAt)])

export type User = typeof users.$inferSelect
export type Reminder = typeof reminders.$inferSelect
export type NewReminder = typeof reminders.$inferInsert
export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect
