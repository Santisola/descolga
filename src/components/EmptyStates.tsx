'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckIcon, RepeatIcon } from './icons'
import { useToast } from './Toast'

const EXAMPLES = ['Llevar el auto a lavar', 'Comprar pilas AA', 'Renovar la SUBE']

/**
 * Design 1j: no tour, no steps. The field above is already open; these are just
 * tappable examples that create a real first reminder.
 */
export function EmptyFirstUse() {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)

  async function create(title: string) {
    if (busy) return
    setBusy(title)
    try {
      const response = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      if (!response.ok) throw new Error('No se pudo guardar.')
      router.refresh()
      toast.show('Anotado.')
    } catch (error) {
      toast.show((error as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="dg-empty">
      <span className="dg-empty-mark" />
      <h4>Todavía no anotaste nada</h4>
      <p>Sirve para lo chico, eso que decís &ldquo;después me fijo&rdquo; y se te cuelga hasta el último momento.</p>

      <div style={{ marginTop: 26, display: 'flex', flexDirection: 'column', gap: 9 }}>
        <span className="dg-eyebrow">Probá con</span>
        <div className="dg-chips">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              className="dg-chip"
              style={{ borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }}
              disabled={busy !== null}
              onClick={() => void create(example)}
            >
              {busy === example ? 'Guardando…' : example}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export type NextRecurring = { title: string; when: string }

/**
 * Design 1k: a one-line celebration, plus proof that the recurrent ones didn't
 * disappear — they're just scheduled.
 */
export function EmptyAllDone({
  doneToday,
  insistedToday,
  nextRecurring,
}: {
  doneToday: number
  insistedToday: number
  nextRecurring: NextRecurring | null
}) {
  return (
    <div className="dg-empty">
      <div className="dg-empty-badge">
        <CheckIcon size={22} />
      </div>
      <h4>No te queda nada colgado</h4>
      <p>{summary(doneToday, insistedToday)}</p>

      {nextRecurring && (
        <div style={{ marginTop: 30, display: 'flex', flexDirection: 'column', gap: 11 }}>
          <span className="dg-eyebrow">Vuelve solo</span>
          <div
            className="card"
            style={{ padding: '13px 14px', flexDirection: 'row', alignItems: 'center', gap: 11 }}
          >
            <span style={{ color: 'var(--color-accent)', display: 'flex', flex: 'none' }}>
              <RepeatIcon />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15 }}>{nextRecurring.title}</div>
              <div style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>{nextRecurring.when}</div>
            </div>
          </div>
        </div>
      )}

      {doneToday > 0 && (
        <div style={{ marginTop: 26 }}>
          <Link className="btn btn-secondary" style={{ fontSize: 13 }} href="/hechos">
            Ver los {doneToday} {doneToday === 1 ? 'hecho' : 'hechos'} de hoy
          </Link>
        </div>
      )}
    </div>
  )
}

function summary(doneToday: number, insistedToday: number): string {
  if (doneToday === 0) return 'Nada pendiente y nada vencido. Aprovechá.'
  const closed = doneToday === 1 ? 'Cerraste una cosa hoy' : `Cerraste ${doneToday} cosas hoy`
  if (insistedToday === 0) return `${closed}.`
  if (insistedToday === 1) return `${closed}, una de ellas venía insistiendo.`
  return `${closed}, ${insistedToday} de ellas venían insistiendo.`
}
