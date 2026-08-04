import { desc, eq } from 'drizzle-orm'
import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { SettingsForm, type DeviceView } from '@/components/SettingsForm'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { pushSubscriptions } from '@/lib/db/schema'
import { formatRelative } from '@/lib/dates'
import { toSettingsView } from '@/lib/view'
import { ChevronLeftIcon } from '@/components/icons'

export const dynamic = 'force-dynamic'

export default async function AjustesPage() {
  const user = await requireUser()

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, user.id))
    .orderBy(desc(pushSubscriptions.lastSeenAt))

  const devices: DeviceView[] = subs.map((sub) => ({
    id: sub.id,
    label: sub.deviceLabel,
    status: sub.expiredAt
      ? 'Suscripción vencida'
      : `Activo · visto ${formatRelative(sub.lastSeenAt)}`,
    active: sub.expiredAt === null,
  }))

  return (
    <AppShell user={user} active="ajustes">
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
            Ajustes
          </h1>
        </div>
      </header>

      <SettingsForm
        settings={toSettingsView(user)}
        devices={devices}
        vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''}
      />
    </AppShell>
  )
}
