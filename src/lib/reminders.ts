import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { db } from './db'
import { reminders, type NewReminder, type Reminder, type User } from './db/schema'
import { addDays, addMinutes, chipToDueDate, localDayDiff } from './dates'

export type NotifyMode = 'once' | 'persistent' | 'insist'

export type CreateInput = {
  title: string
  notes?: string | null
  /** Either an explicit instant or one of the quick-add chips. */
  dueAt?: Date | null
  chip?: 'hoy' | 'manana' | null
  insist?: boolean
  notifyMode?: NotifyMode
  insistIntervalMinutes?: number
  maxRepeats?: number
  recurrenceIntervalDays?: number | null
}

/**
 * Quick add gives us a title and maybe a chip. Everything else comes from the
 * user's defaults — this is the "el 90% se crea escribiendo solo el título" path.
 */
export function buildNewReminder(user: User, input: CreateInput, now = new Date()): NewReminder {
  const dueAt = input.dueAt ?? chipToDueDate(input.chip ?? null, user.timezone, now)
  const mode: NotifyMode = input.notifyMode ?? (input.insist ? 'insist' : 'once')

  // With no date at all, `once` has nothing to fire on — it just sits in the
  // list. `insist` starts nagging right away, which is the documented default.
  const notifyAt = dueAt ?? (mode === 'once' ? null : now)

  return {
    userId: user.id,
    title: input.title.trim(),
    notes: input.notes?.trim() || null,
    dueAt,
    notifyAt,
    notifyMode: mode,
    insistIntervalMinutes: input.insistIntervalMinutes ?? user.defaultInsistIntervalMinutes,
    maxRepeats: input.maxRepeats ?? user.defaultMaxRepeats,
    recurrenceIntervalDays: input.recurrenceIntervalDays ?? null,
    status: 'pending',
    sentCount: 0,
    lastNotifiedAt: null,
  }
}

export async function createReminder(user: User, input: CreateInput): Promise<Reminder> {
  const [row] = await db.insert(reminders).values(buildNewReminder(user, input)).returning()
  return row
}

/**
 * The instant this reminder wants its next push, or null if it wants none.
 * Quiet hours are applied by the scheduler, not here.
 */
export function nextFireAt(reminder: Reminder): Date | null {
  if (reminder.status !== 'pending') return null

  const repeats = reminder.notifyMode !== 'once'
  const base = reminder.notifyAt ?? reminder.dueAt

  if (!reminder.lastNotifiedAt) {
    if (base) return base
    // No schedule and never notified: only the repeating modes self-start.
    return repeats ? reminder.createdAt : null
  }

  if (!repeats) return null
  if (reminder.sentCount >= reminder.maxRepeats) return null
  return addMinutes(reminder.lastNotifiedAt, reminder.insistIntervalMinutes)
}

/** True while the reminder is actively re-notifying — drives the pulsing dot. */
export function isInsisting(reminder: Reminder): boolean {
  return (
    reminder.status === 'pending' &&
    reminder.notifyMode !== 'once' &&
    reminder.sentCount > 0 &&
    reminder.sentCount < reminder.maxRepeats
  )
}

/** The insistence cap was hit: still pending, but no longer nagging. */
export function isExhausted(reminder: Reminder): boolean {
  return (
    reminder.status === 'pending' &&
    reminder.notifyMode !== 'once' &&
    reminder.sentCount >= reminder.maxRepeats
  )
}

/**
 * Mark done. A recurrent reminder doesn't close: it schedules its next
 * occurrence at `completedAt + intervalDays` and returns to pending, which is
 * the whole point of anchoring recurrence to completion instead of a fixed date.
 */
export async function completeReminder(userId: string, reminderId: string): Promise<Reminder | null> {
  const [current] = await db
    .select()
    .from(reminders)
    .where(and(eq(reminders.id, reminderId), eq(reminders.userId, userId)))
    .limit(1)
  if (!current) return null

  const now = new Date()

  if (current.recurrenceIntervalDays && current.recurrenceIntervalDays > 0) {
    const nextDue = addDays(now, current.recurrenceIntervalDays)
    const [row] = await db
      .update(reminders)
      .set({
        status: 'pending',
        completedAt: now,
        dueAt: nextDue,
        notifyAt: nextDue,
        snoozedUntil: null,
        sentCount: 0,
        lastNotifiedAt: null,
        updatedAt: now,
      })
      .where(eq(reminders.id, reminderId))
      .returning()
    return row
  }

  const [row] = await db
    .update(reminders)
    .set({ status: 'done', completedAt: now, snoozedUntil: null, updatedAt: now })
    .where(eq(reminders.id, reminderId))
    .returning()
  return row
}

export async function reopenReminder(userId: string, reminderId: string): Promise<Reminder | null> {
  const now = new Date()
  const [row] = await db
    .update(reminders)
    .set({ status: 'pending', completedAt: null, sentCount: 0, lastNotifiedAt: null, updatedAt: now })
    .where(and(eq(reminders.id, reminderId), eq(reminders.userId, userId)))
    .returning()
  return row ?? null
}

/**
 * Posponer. The insistence counter resets: snoozing is a deliberate "not now",
 * so the reminder gets a fresh run of avisos from the new time rather than
 * arriving already spent.
 */
export async function snoozeReminder(
  userId: string,
  reminderId: string,
  minutes: number,
): Promise<Reminder | null> {
  const until = addMinutes(new Date(), minutes)
  const [row] = await db
    .update(reminders)
    .set({
      status: 'snoozed',
      snoozedUntil: until,
      notifyAt: until,
      sentCount: 0,
      lastNotifiedAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(reminders.id, reminderId), eq(reminders.userId, userId)))
    .returning()
  return row ?? null
}

export async function archiveReminder(userId: string, reminderId: string) {
  const [row] = await db
    .update(reminders)
    .set({ status: 'archived', updatedAt: new Date() })
    .where(and(eq(reminders.id, reminderId), eq(reminders.userId, userId)))
    .returning()
  return row ?? null
}

export async function deleteReminder(userId: string, reminderId: string) {
  const rows = await db
    .delete(reminders)
    .where(and(eq(reminders.id, reminderId), eq(reminders.userId, userId)))
    .returning({ id: reminders.id })
  return rows.length > 0
}

export type UpdateInput = {
  title?: string
  notes?: string | null
  dueAt?: Date | null
  notifyMode?: NotifyMode
  insistIntervalMinutes?: number
  maxRepeats?: number
  recurrenceIntervalDays?: number | null
}

export async function updateReminder(
  userId: string,
  reminderId: string,
  input: UpdateInput,
): Promise<Reminder | null> {
  const [current] = await db
    .select()
    .from(reminders)
    .where(and(eq(reminders.id, reminderId), eq(reminders.userId, userId)))
    .limit(1)
  if (!current) return null

  const patch: Partial<NewReminder> = { updatedAt: new Date() }
  if (input.title !== undefined) patch.title = input.title.trim()
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null
  if (input.insistIntervalMinutes !== undefined) patch.insistIntervalMinutes = input.insistIntervalMinutes
  if (input.maxRepeats !== undefined) patch.maxRepeats = input.maxRepeats
  if (input.recurrenceIntervalDays !== undefined) {
    patch.recurrenceIntervalDays = input.recurrenceIntervalDays
  }

  const nextMode = input.notifyMode ?? current.notifyMode
  if (input.notifyMode !== undefined) patch.notifyMode = input.notifyMode

  if (input.dueAt !== undefined) {
    patch.dueAt = input.dueAt
    patch.notifyAt = input.dueAt ?? (nextMode === 'once' ? null : new Date())
  } else if (input.notifyMode !== undefined && current.notifyAt === null && nextMode !== 'once') {
    // Turning insist on for a dateless reminder starts it now.
    patch.notifyAt = new Date()
  }

  // Any change to when or how we notify restarts the cadence — otherwise a
  // reminder edited after 5 avisos would stay silent under its old counter.
  const cadenceChanged =
    input.dueAt !== undefined ||
    input.notifyMode !== undefined ||
    input.insistIntervalMinutes !== undefined ||
    input.maxRepeats !== undefined
  if (cadenceChanged) {
    patch.sentCount = 0
    patch.lastNotifiedAt = null
    if (current.status === 'snoozed') {
      patch.status = 'pending'
      patch.snoozedUntil = null
    }
  }

  const [row] = await db.update(reminders).set(patch).where(eq(reminders.id, reminderId)).returning()
  return row
}

// ── Reading ───────────────────────────────────────────────────────────────

export async function getReminder(userId: string, reminderId: string): Promise<Reminder | null> {
  const [row] = await db
    .select()
    .from(reminders)
    .where(and(eq(reminders.id, reminderId), eq(reminders.userId, userId)))
    .limit(1)
  return row ?? null
}

export async function listOpen(userId: string): Promise<Reminder[]> {
  return db
    .select()
    .from(reminders)
    .where(and(eq(reminders.userId, userId), inArray(reminders.status, ['pending', 'snoozed'])))
    .orderBy(asc(reminders.dueAt), asc(reminders.createdAt))
}

export async function listDone(userId: string, limit = 50): Promise<Reminder[]> {
  return db
    .select()
    .from(reminders)
    .where(and(eq(reminders.userId, userId), eq(reminders.status, 'done')))
    .orderBy(desc(reminders.completedAt))
    .limit(limit)
}

export async function listArchived(userId: string, limit = 100): Promise<Reminder[]> {
  return db
    .select()
    .from(reminders)
    .where(and(eq(reminders.userId, userId), eq(reminders.status, 'archived')))
    .orderBy(desc(reminders.updatedAt))
    .limit(limit)
}

export async function countsFor(userId: string) {
  const rows = await db
    .select({ status: reminders.status, notifyMode: reminders.notifyMode, sentCount: reminders.sentCount, maxRepeats: reminders.maxRepeats })
    .from(reminders)
    .where(eq(reminders.userId, userId))

  return {
    open: rows.filter((r) => r.status === 'pending' || r.status === 'snoozed').length,
    insisting: rows.filter(
      (r) => r.status === 'pending' && r.notifyMode !== 'once' && r.sentCount > 0 && r.sentCount < r.maxRepeats,
    ).length,
    done: rows.filter((r) => r.status === 'done').length,
    archived: rows.filter((r) => r.status === 'archived').length,
  }
}

// ── Grouping for the list screen ──────────────────────────────────────────

export type GroupKey = 'insistiendo' | 'atrasado' | 'hoy' | 'semana' | 'despues' | 'sinFecha'

export const GROUP_LABELS: Record<GroupKey, string> = {
  insistiendo: 'Insistiendo',
  atrasado: 'Atrasado',
  hoy: 'Hoy',
  semana: 'Esta semana',
  despues: 'Más adelante',
  sinFecha: 'Sin fecha',
}

export const GROUP_ORDER: GroupKey[] = ['insistiendo', 'atrasado', 'hoy', 'semana', 'despues', 'sinFecha']

export function groupOf(reminder: Reminder, timezone: string, now = new Date()): GroupKey {
  if (isInsisting(reminder)) return 'insistiendo'
  const due = reminder.snoozedUntil ?? reminder.dueAt
  if (!due) return 'sinFecha'
  const days = localDayDiff(now, due, timezone)
  if (days < 0) return 'atrasado'
  if (days === 0) return 'hoy'
  if (days <= 7) return 'semana'
  return 'despues'
}

export function groupReminders(list: Reminder[], timezone: string, now = new Date()) {
  const groups = new Map<GroupKey, Reminder[]>()
  for (const reminder of list) {
    const key = groupOf(reminder, timezone, now)
    const bucket = groups.get(key)
    if (bucket) bucket.push(reminder)
    else groups.set(key, [reminder])
  }
  return GROUP_ORDER.filter((key) => groups.has(key)).map((key) => ({
    key,
    label: GROUP_LABELS[key],
    items: groups.get(key)!,
  }))
}
