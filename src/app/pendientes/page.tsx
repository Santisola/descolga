import { AppShell } from '@/components/AppShell'
import { EmptyAllDone, EmptyFirstUse, type NextRecurring } from '@/components/EmptyStates'
import { PendientesShell } from '@/components/PendientesShell'
import { ReminderList } from '@/components/ReminderList'
import { requireUser } from '@/lib/auth'
import { formatDueLong, formatHeaderDate, localDayDiff, minutesToClock } from '@/lib/dates'
import { groupReminders, isInsisting, listDone, listOpen } from '@/lib/reminders'
import { describeInterval, toView, type GroupView } from '@/lib/view'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ filtro?: string; nuevo?: string; titulo?: string }>

export default async function PendientesPage({ searchParams }: { searchParams: SearchParams }) {
  const { filtro, nuevo, titulo } = await searchParams
  const user = await requireUser()
  const now = new Date()

  const open = await listOpen(user.id)
  const onlyInsisting = filtro === 'insistiendo'
  const visible = onlyInsisting ? open.filter(isInsisting) : open

  const groups: GroupView[] = groupReminders(visible, user.timezone, now).map((group) => ({
    key: group.key,
    label: group.label,
    items: group.items.map((reminder) => toView(reminder, user, now)),
  }))

  // "Más adelante" doesn't count as something needing attention now — that's
  // what lets design 1k's "no te queda nada colgado" appear while recurrent
  // reminders sit scheduled weeks out.
  const soon = groups.filter((group) => group.key !== 'despues')
  const later = groups.find((group) => group.key === 'despues')

  const done = await listDone(user.id, 60)
  const doneToday = done.filter(
    (reminder) => reminder.completedAt && localDayDiff(now, reminder.completedAt, user.timezone) === 0,
  )
  const insistedToday = doneToday.filter((reminder) => reminder.notifyMode !== 'once' && reminder.sentCount > 0)

  const nextRecurring: NextRecurring | null =
    later?.items.length && later.items[0]
      ? {
          title: later.items[0].title,
          when: later.items[0].dueAtIso
            ? `Vuelve el ${formatDueLong(new Date(later.items[0].dueAtIso), user.timezone, now).replace(/^Vence el /, '')}`
            : 'Sin fecha',
        }
      : null

  const quietLabel = `${minutesToClock(user.quietStartMinutes)} – ${minutesToClock(user.quietEndMinutes)}`
  const cadence = describeInterval(user.defaultInsistIntervalMinutes)

  const showFirstUse = open.length === 0 && done.length === 0
  const showAllDone = soon.length === 0 && !showFirstUse

  return (
    <AppShell user={user} active={onlyInsisting ? 'insistiendo' : 'pendientes'}>
      <PendientesShell
        kicker={formatHeaderDate(now, user.timezone)}
        title={onlyInsisting ? 'Insistiendo' : 'Pendientes'}
        insistHint={`Cada ${cadence} hasta que lo marqués`}
        cadenceLine={`Te aviso cada ${cadence} hasta que lo marqués hecho`}
        quietLine={`Nunca entre las ${minutesToClock(user.quietStartMinutes)} y las ${minutesToClock(user.quietEndMinutes)}`}
        vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''}
        hasReminders={open.length > 0}
        openNew={nuevo === '1'}
        initialTitle={titulo ?? ''}
      >
        {showFirstUse && <EmptyFirstUse />}

        {showAllDone && (
          <EmptyAllDone
            doneToday={doneToday.length}
            insistedToday={insistedToday.length}
            nextRecurring={nextRecurring}
          />
        )}

        {onlyInsisting && groups.length === 0 && !showFirstUse && (
          <div className="dg-empty">
            <span className="dg-empty-mark" />
            <h4>Nada está insistiendo</h4>
            <p>Cuando un recordatorio empiece a repetir sus avisos, va a aparecer acá primero.</p>
          </div>
        )}

        {groups.length > 0 && <ReminderList groups={groups} />}

        <p className="dg-note" style={{ padding: '28px 20px 0' }}>
          {quietLabel === '00:00 – 00:00'
            ? 'No tenés horas de silencio configuradas.'
            : `Silencio de ${quietLabel}: en esa ventana no te llega nada.`}
        </p>
      </PendientesShell>
    </AppShell>
  )
}
