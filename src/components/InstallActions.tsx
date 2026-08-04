'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { enablePush, isStandalone } from '@/lib/push-client'
import { useToast } from './Toast'

/**
 * "Ya la instalé" can't be taken on faith: if the page is still running in a
 * Safari tab, push isn't available and pretending otherwise is how a user ends
 * up thinking the app is broken.
 */
export function InstallActions({ vapidPublicKey }: { vapidPublicKey: string }) {
  const router = useRouter()
  const toast = useToast()
  const [standalone, setStandalone] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setStandalone(isStandalone())
  }, [])

  async function confirmInstalled() {
    if (!isStandalone()) {
      setStandalone(false)
      toast.show('Todavía estás en el navegador. Abrila desde el ícono nuevo.')
      return
    }
    setBusy(true)
    const state = await enablePush(vapidPublicKey)
    setBusy(false)
    if (state === 'granted') {
      toast.show('Listo, ya te puedo insistir.')
      router.push('/pendientes')
      router.refresh()
    } else if (state === 'denied') {
      toast.show('El permiso quedó bloqueado.')
      router.push('/avisos')
    } else {
      toast.show('No pude activar los avisos todavía.')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {standalone === false && (
        <p className="dg-note" style={{ margin: '0 0 10px' }}>
          Esta pestaña sigue siendo Safari. Cerrala y abrí Descolgá desde el ícono que quedó en tu pantalla de inicio.
        </p>
      )}
      <button
        type="button"
        className="btn btn-primary btn-block"
        style={{ padding: 12 }}
        disabled={busy}
        onClick={() => void confirmInstalled()}
      >
        {busy ? 'Activando…' : 'Ya la instalé'}
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-block"
        style={{ padding: 10, color: 'var(--color-neutral-400)' }}
        onClick={() => router.push('/pendientes')}
      >
        Seguir en el navegador
      </button>
    </div>
  )
}
