import Link from 'next/link'
import type { User } from '@/lib/db/schema'
import { countsFor } from '@/lib/reminders'
import { minutesToClock } from '@/lib/dates'
import { PwaBootstrap } from './PwaBootstrap'
import { ToastProvider } from './Toast'

export type NavKey = 'pendientes' | 'insistiendo' | 'hechos' | 'archivados' | 'ajustes'

type Props = {
  user: User
  active: NavKey
  /** When present, the third pane appears on desktop and replaces the list on mobile. */
  detail?: React.ReactNode
  children: React.ReactNode
}

/**
 * The frame every signed-in screen sits in. On mobile it's a single column; from
 * 1024px up it becomes the sidebar / list / detail layout of design 1m.
 */
export async function AppShell({ user, active, detail, children }: Props) {
  const counts = await countsFor(user.id)
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

  const shellClasses = ['dg-app', 'dg-app--panes']
  if (detail) shellClasses.push('dg-app--with-detail')

  return (
    <ToastProvider>
      <PwaBootstrap vapidPublicKey={vapidPublicKey} />
      <div className={shellClasses.join(' ')}>
        <aside className="dg-sidebar dg-desktop-only">
          <div className="dg-brand" style={{ marginBottom: 0 }}>
            <span className="dg-brand-dot" />
            <span className="dg-brand-name">Descolgá</span>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <NavItem href="/pendientes" label="Pendientes" count={counts.open} current={active === 'pendientes'} />
            <NavItem
              href="/pendientes?filtro=insistiendo"
              label="Insistiendo"
              count={counts.insisting}
              current={active === 'insistiendo'}
            />
            <NavItem href="/hechos" label="Hechos" count={counts.done} current={active === 'hechos'} />
            <NavItem
              href="/archivados"
              label="Archivados"
              count={counts.archived}
              current={active === 'archivados'}
            />
          </nav>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="dg-eyebrow">Silencio</span>
            <span style={{ fontSize: 13, color: 'var(--color-neutral-400)' }}>
              {minutesToClock(user.quietStartMinutes)} – {minutesToClock(user.quietEndMinutes)}
            </span>
            <Link
              href="/ajustes"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 8,
                fontSize: 13,
                color: 'var(--color-neutral-400)',
                textDecoration: 'none',
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  border: '1px solid var(--color-divider)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  flex: 'none',
                  textTransform: 'uppercase',
                }}
              >
                {user.email[0]}
              </span>
              {user.email}
            </Link>
          </div>
        </aside>

        <main className={detail ? 'dg-shell dg-hide-mobile' : 'dg-shell'}>{children}</main>

        {detail && <aside className="dg-detail-pane">{detail}</aside>}
      </div>
    </ToastProvider>
  )
}

function NavItem({
  href,
  label,
  count,
  current,
}: {
  href: string
  label: string
  count: number
  current: boolean
}) {
  return (
    <Link href={href} className="dg-nav-item" aria-current={current ? 'page' : undefined}>
      <span>{label}</span>
      {count > 0 && <span className="dg-nav-count">{count}</span>}
    </Link>
  )
}
