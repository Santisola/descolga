'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { enablePush, isIOS, isStandalone, type PushState } from '@/lib/push-client'
import { BellIcon } from './icons'

type Props = {
  vapidPublicKey: string
  /** "Te aviso cada 60 min hasta que lo marqués hecho" — from the user's defaults. */
  cadenceLine: string
  quietLine: string
  onDismiss: () => void
}

/**
 * Design 1g: the permission ask arrives only once there is something to be
 * notified about, and it says exactly what the permission buys. On iOS Safari
 * there is nothing to ask for yet — the app has to be installed first — so the
 * same sheet redirects to the install guide instead.
 */
export function PermissionSheet({ vapidPublicKey, cadenceLine, quietLine, onDismiss }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<PushState | null>(null)

  const needsInstall = isIOS() && !isStandalone()

  async function activate() {
    setBusy(true)
    const state = await enablePush(vapidPublicKey)
    setResult(state)
    setBusy(false)
    if (state === 'granted') {
      router.refresh()
      onDismiss()
    }
  }

  return (
    <div className="dg-sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="dg-permiso-titulo">
      <div className="dg-sheet" style={{ padding: '28px 24px calc(26px + env(safe-area-inset-bottom))' }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            border: '1px solid var(--color-accent)',
            color: 'var(--color-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 18,
          }}
        >
          <BellIcon size={22} />
        </div>

        {needsInstall ? (
          <>
            <h4 id="dg-permiso-titulo" style={{ margin: '0 0 8px', fontSize: 23 }}>
              Listo, ya está anotado
            </h4>
            <p style={{ margin: '0 0 18px', fontSize: 15, color: 'var(--color-neutral-400)', textWrap: 'pretty' }}>
              Para que te insista, Safari necesita que la app esté en tu pantalla de inicio. Son tres toques y queda
              para siempre.
            </p>
            <Link className="btn btn-primary btn-block" style={{ padding: 12 }} href="/instalar">
              Ver cómo instalarla
            </Link>
          </>
        ) : (
          <>
            <h4 id="dg-permiso-titulo" style={{ margin: '0 0 8px', fontSize: 23 }}>
              Listo, ya está anotado
            </h4>
            <p style={{ margin: '0 0 18px', fontSize: 15, color: 'var(--color-neutral-400)', textWrap: 'pretty' }}>
              Para insistirte necesito mandarte notificaciones. Es lo único que hace la app con el permiso.
            </p>
            <div className="dg-bullets" style={{ marginBottom: 22 }}>
              <span className="dg-bullet">{cadenceLine}</span>
              <span className="dg-bullet">{quietLine}</span>
              <span className="dg-bullet">Podés cortar la insistencia cuando quieras</span>
            </div>

            {result === 'denied' && (
              <div className="dg-error" style={{ marginBottom: 14 }}>
                El navegador bloqueó los avisos. <Link href="/avisos">Cómo reactivarlos</Link>
              </div>
            )}
            {result === 'unsupported' && (
              <div className="dg-error" style={{ marginBottom: 14 }}>
                Este navegador no soporta avisos push. Podés seguir anotando igual.
              </div>
            )}

            <button
              type="button"
              className="btn btn-primary btn-block"
              style={{ padding: 12 }}
              disabled={busy}
              onClick={() => void activate()}
            >
              {busy ? 'Pidiendo permiso…' : 'Activar notificaciones'}
            </button>
          </>
        )}

        <button
          type="button"
          className="btn btn-ghost btn-block"
          style={{ padding: 10, color: 'var(--color-neutral-400)' }}
          onClick={onDismiss}
        >
          Más tarde
        </button>
      </div>
    </div>
  )
}
