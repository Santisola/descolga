'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDateInputShort } from '@/lib/format'
import { BellIcon } from './icons'
import { Toggle } from './Toggle'
import { useToast } from './Toast'

type Props = {
  insistHint: string
  initialTitle?: string
  onClose: () => void
  onCreated?: (reminderId: string) => void
}

/**
 * Design 1d: the same minimal decision as the top bar, but reachable with a
 * thumb. Opens focused, closes itself on save.
 */
export function NewReminderSheet({ insistHint, initialTitle = '', onClose, onCreated }: Props) {
  const router = useRouter()
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState(initialTitle)
  const [chip, setChip] = useState<'hoy' | 'manana' | null>(null)
  const [customDate, setCustomDate] = useState('')
  const [insist, setInsist] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function save() {
    const trimmed = title.trim()
    if (!trimmed || saving) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: trimmed,
          dueAt: customDate ? new Date(`${customDate}T09:00`).toISOString() : undefined,
          chip: customDate ? null : chip,
          insist,
        }),
      })
      const data = (await response.json()) as { reminder?: { id: string }; error?: string }
      if (!response.ok) throw new Error(data.error ?? 'No se pudo guardar.')
      router.refresh()
      toast.show('Anotado.')
      if (data.reminder) onCreated?.(data.reminder.id)
      onClose()
    } catch (cause) {
      setError((cause as Error).message)
      setSaving(false)
    }
  }

  return (
    <div
      className="dg-sheet-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Nuevo recordatorio"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="dg-sheet">
        <div className="dg-sheet-grip" />
        <div className="dg-sheet-kicker">Nuevo recordatorio</div>

        <div className="dg-sheet-field">
          <input
            ref={inputRef}
            className="dg-sheet-input"
            value={title}
            placeholder="Anotá lo primero que se te venga…"
            aria-label="Título del recordatorio"
            enterKeyHint="done"
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void save()
              }
            }}
          />
        </div>

        <div className="dg-chips" style={{ marginTop: 14 }}>
          <button
            type="button"
            className="dg-chip"
            aria-pressed={chip === 'hoy' && !customDate}
            onClick={() => {
              setCustomDate('')
              setChip(chip === 'hoy' ? null : 'hoy')
            }}
          >
            Hoy
          </button>
          <button
            type="button"
            className="dg-chip"
            aria-pressed={chip === 'manana' && !customDate}
            onClick={() => {
              setCustomDate('')
              setChip(chip === 'manana' ? null : 'manana')
            }}
          >
            Mañana
          </button>
          <label className="dg-chip" aria-pressed={Boolean(customDate)}>
            {(customDate ? formatDateInputShort(customDate) : null) ?? 'Fecha…'}
            <input
              type="date"
              value={customDate}
              aria-label="Elegir fecha"
              onChange={(event) => {
                setCustomDate(event.target.value)
                setChip(null)
              }}
              style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
            />
          </label>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-neutral-500)' }}>
            <BellIcon size={16} />
            <span style={{ fontSize: 14, color: 'var(--color-neutral-400)' }}>Insistir</span>
          </div>
          <Toggle checked={insist} onChange={setInsist} label="Insistir hasta que lo marque hecho" />
        </div>
        <div className="dg-hint" style={{ marginTop: 6 }}>
          {insistHint}
        </div>

        {error && (
          <div className="dg-error" style={{ marginTop: 14 }}>
            {error}
          </div>
        )}

        <button
          type="button"
          className="btn btn-primary btn-block"
          style={{ marginTop: 18, padding: 11 }}
          disabled={!title.trim() || saving}
          onClick={() => void save()}
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}
