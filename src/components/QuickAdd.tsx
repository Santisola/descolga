'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDateInputShort } from '@/lib/format'
import { PlusIcon } from './icons'
import { Toggle } from './Toggle'
import { useToast } from './Toast'

export type QuickAddProps = {
  /** "Cada 60 min hasta que lo marqués" — built from the user's defaults. */
  insistHint: string
  /** Pre-filled from the Android share target or the ?nuevo= shortcut. */
  initialTitle?: string
  autoFocus?: boolean
  onCreated?: (reminderId: string) => void
}

type Chip = { key: 'hoy' | 'manana'; label: string }

const CHIPS: Chip[] = [
  { key: 'hoy', label: 'Hoy' },
  { key: 'manana', label: 'Mañana' },
]

/**
 * The product's whole promise: title in, reminder out, under three seconds.
 * Everything optional stays collapsed until the field has focus, and Enter is
 * always enough to save.
 */
export function QuickAdd({ insistHint, initialTitle = '', autoFocus = false, onCreated }: QuickAddProps) {
  const router = useRouter()
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const dateInputId = useId()

  const [title, setTitle] = useState(initialTitle)
  const [open, setOpen] = useState(autoFocus || initialTitle.length > 0)
  const [chip, setChip] = useState<'hoy' | 'manana' | null>(null)
  const [customDate, setCustomDate] = useState('')
  const [insist, setInsist] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  function reset() {
    setTitle('')
    setChip(null)
    setCustomDate('')
    setInsist(false)
    setError(null)
  }

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
          // A picked date wins over a chip; the chip clears when one is set.
          dueAt: customDate ? new Date(`${customDate}T09:00`).toISOString() : undefined,
          chip: customDate ? null : chip,
          insist,
        }),
      })
      const data = (await response.json()) as { reminder?: { id: string }; error?: string }
      if (!response.ok) throw new Error(data.error ?? 'No se pudo guardar.')

      reset()
      inputRef.current?.focus()
      router.refresh()
      toast.show('Anotado.')
      if (data.reminder) onCreated?.(data.reminder.id)
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={open ? 'dg-quickadd dg-quickadd--open' : 'dg-quickadd'}>
      <div className="dg-quickadd-row">
        <span style={{ color: 'var(--color-accent)', display: 'flex' }}>
          <PlusIcon />
        </span>
        <input
          ref={inputRef}
          className="dg-quickadd-input"
          value={title}
          placeholder="Anotá algo antes de que se te vaya…"
          aria-label="Nuevo recordatorio"
          enterKeyHint="done"
          onFocus={() => setOpen(true)}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void save()
            }
            if (event.key === 'Escape' && !title) setOpen(false)
          }}
        />
      </div>

      {open && (
        <div className="dg-quickadd-body">
          <div className="dg-chips">
            {CHIPS.map((option) => (
              <button
                key={option.key}
                type="button"
                className="dg-chip"
                aria-pressed={chip === option.key && !customDate}
                onClick={() => {
                  setCustomDate('')
                  setChip(chip === option.key ? null : option.key)
                }}
              >
                {option.label}
              </button>
            ))}
            <label className="dg-chip" aria-pressed={Boolean(customDate)} htmlFor={dateInputId}>
              {(customDate ? formatDateInputShort(customDate) : null) ?? 'Fecha…'}
              <input
                id={dateInputId}
                type="date"
                value={customDate}
                onChange={(event) => {
                  setCustomDate(event.target.value)
                  setChip(null)
                }}
                style={{
                  // The native picker stays reachable but the chip does the talking.
                  position: 'absolute',
                  width: 1,
                  height: 1,
                  opacity: 0,
                  pointerEvents: 'none',
                }}
              />
            </label>
          </div>

          <div className="dg-quickadd-foot">
            <div>
              <div style={{ fontSize: 14 }}>Insistir</div>
              <div className="dg-hint">{insistHint}</div>
            </div>
            <Toggle checked={insist} onChange={setInsist} label="Insistir hasta que lo marque hecho" />
          </div>

          {error && <div className="dg-error">{error}</div>}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span className="dg-hint">Guardá con Enter</span>
            <button
              type="button"
              className="btn btn-primary"
              style={{ fontSize: 13 }}
              disabled={!title.trim() || saving}
              onClick={() => void save()}
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
