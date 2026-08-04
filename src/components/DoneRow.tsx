'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckIcon } from './icons'
import { useToast } from './Toast'

/** A closed reminder: tapping the circle puts it back on the pending list. */
export function DoneRow({ id, title, when }: { id: string; title: string; when: string }) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  async function reopen() {
    if (busy) return
    setBusy(true)
    try {
      const response = await fetch(`/api/reminders/${id}/reabrir`, { method: 'POST' })
      if (!response.ok) throw new Error('No se pudo reabrir.')
      toast.show('Volvió a pendientes.')
      router.refresh()
    } catch (error) {
      toast.show((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={busy ? 'dg-row dg-row--busy' : 'dg-row'}>
      <button type="button" className="dg-check dg-check--done" aria-label={`Reabrir "${title}"`} onClick={() => void reopen()}>
        <span className="dg-check-circle">
          <CheckIcon size={13} />
        </span>
      </button>
      <div className="dg-row-main" style={{ cursor: 'default' }}>
        <span className="dg-row-title" style={{ color: 'var(--color-neutral-400)' }}>
          {title}
        </span>
      </div>
      <span className="dg-row-due">{when}</span>
    </div>
  )
}
