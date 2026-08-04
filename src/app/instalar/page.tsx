import Link from 'next/link'
import { InstallActions } from '@/components/InstallActions'
import { NotificationPreview } from '@/components/NotificationPreview'
import { ToastProvider } from '@/components/Toast'
import { InfoIcon, ShareIcon } from '@/components/icons'
import { getCurrentUser } from '@/lib/auth'
import { describeInterval } from '@/lib/view'

export const dynamic = 'force-dynamic'

/** Design 1h — the iOS install guide, with the Share glyph drawn as Safari shows it. */
export default async function InstalarPage() {
  const user = await getCurrentUser()
  const cadence = describeInterval(user?.defaultInsistIntervalMinutes ?? 60)

  return (
    <ToastProvider>
      <main className="dg-shell" style={{ paddingBottom: 48 }}>
        <div style={{ padding: '24px 24px 0' }}>
          <span className="tag tag-accent">Solo en iPhone</span>
          <h1 style={{ margin: '16px 0 8px', fontSize: 23 }}>Agregala a tu pantalla de inicio</h1>
          <p style={{ margin: 0, fontSize: 15, color: 'var(--color-neutral-400)', textWrap: 'pretty' }}>
            Safari solo deja mandar notificaciones a las apps instaladas. Son tres toques y queda para siempre.
          </p>
        </div>

        <div style={{ padding: '26px 24px 0' }} className="dg-steps">
          <div className="dg-step">
            <span className="dg-step-num">1</span>
            <div style={{ flex: 1, fontSize: 15 }}>
              Tocá{' '}
              <span
                style={{
                  display: 'inline-flex',
                  verticalAlign: '-4px',
                  margin: '0 2px',
                  color: 'var(--color-accent)',
                }}
              >
                <ShareIcon />
              </span>{' '}
              Compartir, abajo en la barra de Safari
            </div>
          </div>
          <div className="dg-step">
            <span className="dg-step-num">2</span>
            <div style={{ flex: 1, fontSize: 15 }}>
              Bajá y elegí <strong style={{ fontWeight: 500 }}>Agregar a inicio</strong>
            </div>
          </div>
          <div className="dg-step">
            <span className="dg-step-num">3</span>
            <div style={{ flex: 1, fontSize: 15 }}>
              Abrí Descolgá desde el ícono nuevo y activá las notificaciones
            </div>
          </div>
        </div>

        <div className="dg-callout" style={{ margin: '30px 24px 0' }}>
          <span style={{ color: 'var(--color-neutral-400)', display: 'flex', flex: 'none', marginTop: 1 }}>
            <InfoIcon />
          </span>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-neutral-400)' }}>
            Desde el navegador podés anotar igual: lo que no funciona hasta instalarla son los avisos.
          </p>
        </div>

        <div style={{ margin: '32px 24px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span className="dg-eyebrow">Así se ve el aviso</span>
          <NotificationPreview cadence={cadence} dueLine="Vence el viernes." />
        </div>

        <div style={{ margin: '32px 24px 0' }}>
          {user ? (
            <InstallActions vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''} />
          ) : (
            <Link className="btn btn-primary btn-block" style={{ padding: 12 }} href="/entrar">
              Entrar para empezar
            </Link>
          )}
        </div>
      </main>
    </ToastProvider>
  )
}
