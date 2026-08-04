'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { enablePush, pushState } from '@/lib/push-client'
import { useToast } from './Toast'

/**
 * A browser will not re-prompt once permission is denied — the block has to be
 * lifted in settings first. So "Reintentar" re-reads the permission and only
 * then tries to subscribe, instead of firing a request that silently no-ops.
 */
export function RetryPermission({ vapidPublicKey }: { vapidPublicKey: string }) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  async function retry() {
    setBusy(true)
    const current = pushState()
    if (current === 'denied') {
      toast.show('Sigue bloqueado. Cambialo primero en los ajustes del sistema.')
      setBusy(false)
      return
    }
    const state = await enablePush(vapidPublicKey)
    setBusy(false)
    if (state === 'granted') {
      toast.show('Listo, ya te puedo insistir.')
      router.push('/pendientes')
      router.refresh()
    } else if (state === 'needs-install') {
      toast.show('En iPhone hace falta instalarla primero.')
      router.push('/instalar')
    } else {
      toast.show('Todavía no pude activarlos.')
    }
  }

  return (
    <button
      type="button"
      className="btn btn-primary btn-block"
      style={{ padding: 12, marginTop: 6 }}
      disabled={busy}
      onClick={() => void retry()}
    >
      {busy ? 'Probando…' : 'Reintentar'}
    </button>
  )
}
