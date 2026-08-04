import type { Reminder, User } from './db/schema'
import { formatDueLong, formatDueShort, formatTime, minutesToClock } from './dates'
import { describeInterval } from './format'
import { isExhausted, isInsisting, type GroupKey } from './reminders'

export { describeInterval }

/**
 * Every user-visible string is formatted on the server, in the user's timezone,
 * and shipped to the client as plain text. Client components never re-derive a
 * date — that's what keeps the list free of hydration mismatches.
 */
export type ReminderView = {
  id: string
  title: string
  notes: string | null
  status: Reminder['status']
  notifyMode: Reminder['notifyMode']
  insisting: boolean
  exhausted: boolean
  muted: boolean
  /** Terse right-hand label: "18:00", "jue", "3 ago". */
  dueShort: string | null
  /** Accent line under the title when the reminder is actively insisting. */
  meta: string | null
  /** Neutral line: "Vence el viernes", "Pospuesto hasta las 20:00". */
  sub: string | null
  /** Compact mode label for the desktop list: "un solo aviso". */
  modeLabel: string
  recurrence: string | null
  canSnooze: boolean
  insistIntervalMinutes: number
  maxRepeats: number
  sentCount: number
  dueAtIso: string | null
  recurrenceIntervalDays: number | null
}

export function toView(reminder: Reminder, user: User, now = new Date()): ReminderView {
  const tz = user.timezone
  const insisting = isInsisting(reminder)
  const exhausted = isExhausted(reminder)
  const snoozed = reminder.status === 'snoozed' && reminder.snoozedUntil !== null

  const meta = insisting
    ? `Insistiendo · cada ${describeInterval(reminder.insistIntervalMinutes)} · aviso ${reminder.sentCount} de ${reminder.maxRepeats}`
    : null

  let sub: string | null = null
  if (snoozed) sub = `Pospuesto hasta las ${formatTime(reminder.snoozedUntil!, tz)}`
  else if (exhausted) sub = `Sin más avisos · ${reminder.dueAt ? formatDueLong(reminder.dueAt, tz, now).toLowerCase() : 'sin fecha'}`
  else if (reminder.dueAt) sub = formatDueLong(reminder.dueAt, tz, now)
  else if (reminder.notifyMode === 'once') sub = null

  const due = reminder.snoozedUntil ?? reminder.dueAt

  return {
    id: reminder.id,
    title: reminder.title,
    notes: reminder.notes,
    status: reminder.status,
    notifyMode: reminder.notifyMode,
    insisting,
    exhausted,
    muted: snoozed,
    dueShort: due ? formatDueShort(due, tz, now) : null,
    meta,
    sub,
    modeLabel: describeMode(reminder),
    recurrence:
      reminder.recurrenceIntervalDays && reminder.recurrenceIntervalDays > 0
        ? `repite cada ${reminder.recurrenceIntervalDays} días`
        : null,
    canSnooze: reminder.status === 'pending',
    insistIntervalMinutes: reminder.insistIntervalMinutes,
    maxRepeats: reminder.maxRepeats,
    sentCount: reminder.sentCount,
    dueAtIso: reminder.dueAt ? reminder.dueAt.toISOString() : null,
    recurrenceIntervalDays: reminder.recurrenceIntervalDays,
  }
}

function describeMode(reminder: Reminder): string {
  if (reminder.notifyMode === 'once') return 'un solo aviso'
  if (reminder.notifyMode === 'persistent') return 'aviso fijo'
  return `insiste cada ${describeInterval(reminder.insistIntervalMinutes)}`
}

export type GroupView = {
  key: GroupKey
  label: string
  items: ReminderView[]
}

export type SettingsView = {
  email: string
  quietStart: string
  quietEnd: string
  defaultInsistIntervalMinutes: number
  defaultMaxRepeats: number
  reviewOnOpen: boolean
  timezone: string
}

export function toSettingsView(user: User): SettingsView {
  return {
    email: user.email,
    quietStart: minutesToClock(user.quietStartMinutes),
    quietEnd: minutesToClock(user.quietEndMinutes),
    defaultInsistIntervalMinutes: user.defaultInsistIntervalMinutes,
    defaultMaxRepeats: user.defaultMaxRepeats,
    reviewOnOpen: user.reviewOnOpen,
    timezone: user.timezone,
  }
}
