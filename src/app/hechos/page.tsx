import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { DoneRow } from '@/components/DoneRow'
import { requireUser } from '@/lib/auth'
import { formatDayMonth, formatTime, localDayDiff } from '@/lib/dates'
import { listDone } from '@/lib/reminders'
import { ChevronLeftIcon } from '@/components/icons'

export const dynamic = 'force-dynamic'

export default async function HechosPage() {
  const user = await requireUser()
  const now = new Date()
  const done = await listDone(user.id, 100)

  return (
    <AppShell user={user} active="hechos">
      <header className="dg-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link
            href="/pendientes"
            className="btn btn-icon btn-secondary dg-round-btn dg-mobile-only"
            aria-label="Volver"
          >
            <ChevronLeftIcon />
          </Link>
          <h1 className="dg-title" style={{ margin: 0 }}>
            Hechos
          </h1>
        </div>
        <span className="dg-kicker">{done.length}</span>
      </header>

      {done.length === 0 ? (
        <div className="dg-empty">
          <span className="dg-empty-mark" />
          <h4>Todavía no cerraste nada</h4>
          <p>Lo que marqués hecho se va a guardar acá, por si necesitás volver a abrirlo.</p>
        </div>
      ) : (
        <div className="dg-list">
          {done.map((reminder) => (
            <DoneRow
              key={reminder.id}
              id={reminder.id}
              title={reminder.title}
              when={
                reminder.completedAt
                  ? localDayDiff(now, reminder.completedAt, user.timezone) === 0
                    ? `Hoy ${formatTime(reminder.completedAt, user.timezone)}`
                    : formatDayMonth(reminder.completedAt, user.timezone)
                  : ''
              }
            />
          ))}
        </div>
      )}
    </AppShell>
  )
}
