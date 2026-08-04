import { and, eq, inArray, isNotNull, lte, sql } from 'drizzle-orm'
import { db } from './db'
import { notificationLog, reminders, users, type Reminder, type User } from './db/schema'
import { formatDueLong } from './dates'
import { isQuiet } from './quiet-hours'
import { buildPayload, sendToUser } from './push'
import { nextFireAt } from './reminders'

export type TickReport = {
  at: string
  woken: number
  considered: number
  sent: number
  skippedQuiet: number
  failures: number
  reminders: Array<{ id: string; title: string; attempt: number; deliveries: number; failed: number }>
}

/**
 * One scheduler pass. Idempotent by construction: a reminder is *claimed* with a
 * conditional UPDATE before any push goes out, so two overlapping ticks can
 * never both send the same aviso.
 *
 * Called from POST /api/cron/tick (Vercel Cron, QStash, or scripts/tick.mjs).
 */
export async function runTick(now = new Date()): Promise<TickReport> {
  const report: TickReport = {
    at: now.toISOString(),
    woken: 0,
    considered: 0,
    sent: 0,
    skippedQuiet: 0,
    failures: 0,
    reminders: [],
  }

  // 1. Snoozes that have elapsed go back to pending.
  const woken = await db
    .update(reminders)
    .set({ status: 'pending', snoozedUntil: null, updatedAt: now })
    .where(
      and(
        eq(reminders.status, 'snoozed'),
        isNotNull(reminders.snoozedUntil),
        lte(reminders.snoozedUntil, now),
      ),
    )
    .returning({ id: reminders.id })
  report.woken = woken.length

  // 2. Every pending reminder that could plausibly fire, with its owner.
  const rows = await db
    .select({ reminder: reminders, user: users })
    .from(reminders)
    .innerJoin(users, eq(users.id, reminders.userId))
    .where(and(eq(reminders.status, 'pending'), inArray(reminders.notifyMode, ['once', 'persistent', 'insist'])))

  for (const { reminder, user } of rows) {
    const fireAt = nextFireAt(reminder)
    if (!fireAt || fireAt.getTime() > now.getTime()) continue
    report.considered += 1

    if (isQuiet(now, user)) {
      // Nothing to persist: the reminder stays due and fires when the window ends.
      report.skippedQuiet += 1
      continue
    }

    const claimed = await claim(reminder, now)
    if (!claimed) continue // another tick got there first

    const results = await sendToUser(user.id, payloadFor(claimed, user))
    const failed = results.filter((r) => !r.ok)
    report.sent += results.filter((r) => r.ok).length
    report.failures += failed.length
    report.reminders.push({
      id: claimed.id,
      title: claimed.title,
      attempt: claimed.sentCount,
      deliveries: results.length - failed.length,
      failed: failed.length,
    })

    if (results.length > 0) {
      await db.insert(notificationLog).values(
        results.map((result) => ({
          reminderId: claimed.id,
          subscriptionId: result.subscriptionId,
          attempt: claimed.sentCount,
          ok: result.ok,
          detail: result.detail ?? null,
        })),
      )
    } else {
      // No live subscription — worth recording so Ajustes can explain the silence.
      await db.insert(notificationLog).values({
        reminderId: claimed.id,
        attempt: claimed.sentCount,
        ok: false,
        detail: 'sin suscripciones activas',
      })
    }
  }

  return report
}

/**
 * Increment the counter only if nobody else already did, matching on the exact
 * `lastNotifiedAt` we based the decision on. Returns the updated row, or null if
 * the row moved under us.
 */
async function claim(reminder: Reminder, now: Date): Promise<Reminder | null> {
  const [row] = await db
    .update(reminders)
    .set({ sentCount: sql`${reminders.sentCount} + 1`, lastNotifiedAt: now, updatedAt: now })
    .where(
      and(
        eq(reminders.id, reminder.id),
        eq(reminders.status, 'pending'),
        eq(reminders.sentCount, reminder.sentCount),
        reminder.lastNotifiedAt === null
          ? sql`${reminders.lastNotifiedAt} is null`
          : eq(reminders.lastNotifiedAt, reminder.lastNotifiedAt),
      ),
    )
    .returning()
  return row ?? null
}

function payloadFor(reminder: Reminder, user: User) {
  const repeats = reminder.notifyMode !== 'once'
  const remaining = reminder.maxRepeats - reminder.sentCount
  const dueLine = reminder.dueAt ? formatDueLong(reminder.dueAt, user.timezone) : null

  const parts: string[] = []
  if (repeats) parts.push(`Aviso ${reminder.sentCount} de ${reminder.maxRepeats}`)
  if (dueLine) parts.push(dueLine.toLowerCase())
  if (repeats && remaining > 0) parts.push('sigo insistiendo hasta que lo marqués')

  return buildPayload({
    reminderId: reminder.id,
    title: reminder.title,
    body: parts.length ? `${parts.join(' · ')}.` : 'Tenés esto pendiente.',
    attempt: reminder.sentCount,
    maxRepeats: reminder.maxRepeats,
    persistent: reminder.notifyMode === 'persistent',
    withActions: true,
    snoozeMinutes: 60,
  })
}
