import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { DoneRow } from '@/components/DoneRow'
import { requireUser } from '@/lib/auth'
import { formatDayMonth } from '@/lib/dates'
import { listArchived } from '@/lib/reminders'
import { ChevronLeftIcon } from '@/components/icons'

export const dynamic = 'force-dynamic'

export default async function ArchivadosPage() {
  const user = await requireUser()
  const archived = await listArchived(user.id)

  return (
    <AppShell user={user} active="archivados">
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
            Archivados
          </h1>
        </div>
      </header>

      {archived.length === 0 ? (
        <div className="dg-empty">
          <span className="dg-empty-mark" />
          <h4>No archivaste nada</h4>
          <p>Archivar sirve para lo que ya no querés ver pero tampoco querés borrar.</p>
        </div>
      ) : (
        <div className="dg-list">
          {archived.map((reminder) => (
            <DoneRow
              key={reminder.id}
              id={reminder.id}
              title={reminder.title}
              when={formatDayMonth(reminder.updatedAt, user.timezone)}
            />
          ))}
        </div>
      )}
    </AppShell>
  )
}
