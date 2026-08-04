import { desc, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { DetailForm, type NotificationLogEntry } from '@/components/DetailForm'
import { ReminderList } from '@/components/ReminderList'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { notificationLog, pushSubscriptions } from '@/lib/db/schema'
import { formatHeaderDate, formatTime, minutesToClock } from '@/lib/dates'
import { getReminder, groupReminders, listOpen } from '@/lib/reminders'
import { toView, type GroupView } from '@/lib/view'

export const dynamic = 'force-dynamic'

export default async function ReminderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()
  const now = new Date()

  const reminder = await getReminder(user.id, id)
  if (!reminder) notFound()

  // "Últimos avisos" — which device got each repeat, newest first.
  const log = await db
    .select({
      sentAt: notificationLog.sentAt,
      ok: notificationLog.ok,
      device: pushSubscriptions.deviceLabel,
    })
    .from(notificationLog)
    .leftJoin(pushSubscriptions, eq(pushSubscriptions.id, notificationLog.subscriptionId))
    .where(eq(notificationLog.reminderId, reminder.id))
    .orderBy(desc(notificationLog.sentAt))
    .limit(6)

  const entries: NotificationLogEntry[] = log.map((row) => ({
    at: formatTime(row.sentAt, user.timezone),
    device: row.device ?? 'sin dispositivo',
    ok: row.ok,
  }))

  const quietLabel = `${minutesToClock(user.quietStartMinutes)} – ${minutesToClock(user.quietEndMinutes)}`

  // The list keeps rendering behind the detail pane on desktop (design 1m); on
  // mobile AppShell hides it and the detail takes the whole screen.
  const open = await listOpen(user.id)
  const groups: GroupView[] = groupReminders(open, user.timezone, now).map((group) => ({
    key: group.key,
    label: group.label,
    items: group.items.map((row) => toView(row, user, now)),
  }))

  return (
    <AppShell
      user={user}
      active="pendientes"
      detail={
        <DetailForm
          reminder={toView(reminder, user, now)}
          quietLabel={quietLabel}
          log={entries}
          variant="page"
        />
      }
    >
      <header className="dg-topbar">
        <div>
          <div className="dg-kicker">{formatHeaderDate(now, user.timezone)}</div>
          <h1 className="dg-title">Pendientes</h1>
        </div>
      </header>
      <ReminderList groups={groups} activeId={reminder.id} />
    </AppShell>
  )
}
