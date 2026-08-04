import Link from 'next/link'
import { RetryPermission } from '@/components/RetryPermission'
import { ToastProvider } from '@/components/Toast'
import { BellOffIcon } from '@/components/icons'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * Design 1i — permission denied. No scolding: what's lost, how to turn it back
 * on per platform, and what keeps working regardless.
 */
export default async function AvisosBloqueadosPage() {
  const user = await getCurrentUser()

  return (
    <ToastProvider>
      <main className="dg-shell" style={{ paddingBottom: 48 }}>
        <div className="dg-callout dg-callout--warn" style={{ margin: '20px 16px 18px' }}>
          <span style={{ color: 'var(--color-neutral-300)', display: 'flex', flex: 'none', marginTop: 2 }}>
            <BellOffIcon />
          </span>
          <div>
            <div style={{ fontSize: 15 }}>Los avisos están bloqueados</div>
            <p style={{ margin: '5px 0 0', fontSize: 13, color: 'var(--color-neutral-400)', textWrap: 'pretty' }}>
              Podés seguir anotando y la lista funciona igual, pero nadie te va a insistir: vas a tener que abrir la
              app para acordarte.
            </p>
          </div>
        </div>

        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span className="dg-field-label">Cómo reactivarlos</span>

          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 13, color: 'var(--color-accent-300)', marginBottom: 6 }}>iPhone</div>
            <div style={{ fontSize: 14, color: 'var(--color-neutral-300)' }}>
              Ajustes → Descolgá → Notificaciones → Permitir
            </div>
          </div>

          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 13, color: 'var(--color-accent-300)', marginBottom: 6 }}>Android · Chrome</div>
            <div style={{ fontSize: 14, color: 'var(--color-neutral-300)' }}>
              Tocá el candado en la barra de direcciones → Notificaciones → Permitir
            </div>
          </div>

          <RetryPermission vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''} />

          <div className="dg-rule" style={{ marginTop: 10 }} />

          <p className="dg-note" style={{ margin: 0 }}>
            Mientras tanto, al abrir la app te muestro lo vencido arriba de la lista. Podés apagar ese repaso desde{' '}
            {user ? <Link href="/ajustes">Ajustes</Link> : 'Ajustes'}.
          </p>

          <Link className="btn btn-secondary" style={{ alignSelf: 'flex-start', fontSize: 13 }} href="/pendientes">
            Volver a la lista
          </Link>
        </div>
      </main>
    </ToastProvider>
  )
}
