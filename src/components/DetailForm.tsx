'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ReminderView } from '@/lib/view'
import { describeInterval, formatDateInputShort } from '@/lib/format'
import { Toggle } from './Toggle'
import { useToast } from './Toast'

export type NotificationLogEntry = { at: string; device: string; ok: boolean }

type Props = {
  reminder: ReminderView
  quietLabel: string
  /** Rendered as "Últimos avisos" — already formatted in the user's zone. */
  log: NotificationLogEntry[]
  /** Desktop shows a Cerrar affordance; mobile shows Cancelar in the header. */
  variant: 'page' | 'pane'
}

type DueChoice = 'hoy' | 'manana' | 'custom' | 'none'

const INTERVAL_STEPS = [5, 10, 15, 30, 45, 60, 90, 120, 180, 240, 360, 480, 720, 1440]

/**
 * Design 1e / the detail pane of 1m: everything quick add deliberately skips.
 * The cadence panel only appears when the mode actually repeats.
 */
export function DetailForm({ reminder, quietLabel, log, variant }: Props) {
  const router = useRouter()
  const toast = useToast()

  const [title, setTitle] = useState(reminder.title)
  const [notes, setNotes] = useState(reminder.notes ?? '')
  const [due, setDue] = useState<DueChoice>(reminder.dueAtIso ? 'custom' : 'none')
  const [customDate, setCustomDate] = useState(reminder.dueAtIso ? reminder.dueAtIso.slice(0, 10) : '')
  const [mode, setMode] = useState(reminder.notifyMode)
  const [interval, setInterval] = useState(reminder.insistIntervalMinutes)
  const [maxRepeats, setMaxRepeats] = useState(reminder.maxRepeats)
  const [recurring, setRecurring] = useState(reminder.recurrenceIntervalDays !== null)
  const [recurrenceDays, setRecurrenceDays] = useState(reminder.recurrenceIntervalDays ?? 20)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const repeats = mode !== 'once'

  const dueAtIso = useMemo(() => resolveDue(due, customDate), [due, customDate])

  async function call(path: string, init: RequestInit) {
    const response = await fetch(path, init)
    const data = (await response.json().catch(() => ({}))) as { error?: string }
    if (!response.ok) throw new Error(data.error ?? 'No se pudo guardar.')
    return data
  }

  async function save() {
    if (busy) return
    if (!title.trim()) {
      setError('El título no puede quedar vacío.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await call(`/api/reminders/${reminder.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title,
          notes: notes.trim() ? notes : null,
          dueAt: dueAtIso,
          notifyMode: mode,
          insistIntervalMinutes: interval,
          maxRepeats,
          recurrenceIntervalDays: recurring ? recurrenceDays : null,
        }),
      })
      router.refresh()
      toast.show('Guardado.')
      if (variant === 'page') router.push('/pendientes')
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function action(path: string, message: string, leave: boolean, body?: unknown) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await call(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
      toast.show(message)
      router.refresh()
      if (leave) router.push('/pendientes')
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (busy) return
    setBusy(true)
    try {
      await call(`/api/reminders/${reminder.id}`, { method: 'DELETE' })
      toast.show('Borrado.')
      router.push('/pendientes')
      router.refresh()
    } catch (cause) {
      setError((cause as Error).message)
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: variant === 'page' ? '8px 16px 10px' : '0 0 4px',
        }}
      >
        {variant === 'page' ? (
          <Link className="btn btn-ghost" style={{ fontSize: 14 }} href="/pendientes">
            Cancelar
          </Link>
        ) : (
          <span className="dg-field-label">Detalle</span>
        )}
        <button type="button" className="btn btn-primary" style={{ fontSize: 13 }} disabled={busy} onClick={() => void save()}>
          {busy ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      <div className="dg-section">
        <div className="dg-field">
          <label className="dg-field-label" htmlFor={`titulo-${reminder.id}`}>
            Recordatorio
          </label>
          <input
            id={`titulo-${reminder.id}`}
            className="input"
            style={{ fontSize: 17, minHeight: 42 }}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <textarea
            className="input"
            style={{ minHeight: 64, fontSize: 14 }}
            placeholder="Notas (opcional)"
            aria-label="Notas"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        <div className="dg-rule" />

        <div className="dg-field">
          <span className="dg-field-label">Vencimiento</span>
          <div className="dg-chips">
            <button type="button" className="dg-chip" aria-pressed={due === 'hoy'} onClick={() => setDue('hoy')}>
              Hoy
            </button>
            <button
              type="button"
              className="dg-chip"
              aria-pressed={due === 'manana'}
              onClick={() => setDue('manana')}
            >
              Mañana
            </button>
            <label className="dg-chip" aria-pressed={due === 'custom'}>
              {(due === 'custom' && customDate ? formatDateInputShort(customDate) : null) ?? 'Fecha…'}
              <input
                type="date"
                aria-label="Elegir fecha de vencimiento"
                value={customDate}
                onChange={(event) => {
                  setCustomDate(event.target.value)
                  setDue(event.target.value ? 'custom' : 'none')
                }}
                style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
              />
            </label>
            <button type="button" className="dg-chip" aria-pressed={due === 'none'} onClick={() => setDue('none')}>
              Sin fecha
            </button>
          </div>
        </div>

        <div className="dg-field">
          <span className="dg-field-label">Cómo avisarte</span>
          <div className="seg">
            <label className="seg-opt">
              <input
                type="radio"
                name={`modo-${reminder.id}`}
                checked={mode === 'once'}
                onChange={() => setMode('once')}
              />
              Una vez
            </label>
            <label className="seg-opt">
              <input
                type="radio"
                name={`modo-${reminder.id}`}
                checked={mode === 'persistent'}
                onChange={() => setMode('persistent')}
              />
              Fija
            </label>
            <label className="seg-opt">
              <input
                type="radio"
                name={`modo-${reminder.id}`}
                checked={mode === 'insist'}
                onChange={() => setMode('insist')}
              />
              Insistir
            </label>
          </div>
          <span className="dg-note">
            La notificación fija solo funciona en Android; en iPhone se degrada a insistir.
          </span>
        </div>

        {repeats && (
          <div className="dg-cadence">
            <div className="dg-setting">
              <span style={{ fontSize: 14 }}>Repetir el aviso cada</span>
              <span className="dg-stepper">
                <button
                  type="button"
                  className="btn btn-secondary btn-icon"
                  aria-label="Menos frecuente"
                  onClick={() => setInterval(step(INTERVAL_STEPS, interval, -1))}
                >
                  −
                </button>
                <span className="dg-stepper-value">{describeInterval(interval)}</span>
                <button
                  type="button"
                  className="btn btn-secondary btn-icon"
                  aria-label="Más frecuente"
                  onClick={() => setInterval(step(INTERVAL_STEPS, interval, 1))}
                >
                  +
                </button>
              </span>
            </div>

            <div className="dg-setting">
              <span style={{ fontSize: 14 }}>Hasta un tope de</span>
              <span className="dg-stepper">
                <button
                  type="button"
                  className="btn btn-secondary btn-icon"
                  aria-label="Menos avisos"
                  onClick={() => setMaxRepeats(Math.max(1, maxRepeats - 1))}
                >
                  −
                </button>
                <span className="dg-stepper-value">{maxRepeats} {maxRepeats === 1 ? 'aviso' : 'avisos'}</span>
                <button
                  type="button"
                  className="btn btn-secondary btn-icon"
                  aria-label="Más avisos"
                  onClick={() => setMaxRepeats(Math.min(50, maxRepeats + 1))}
                >
                  +
                </button>
              </span>
            </div>

            <div className="dg-setting">
              <span style={{ fontSize: 13, color: 'var(--color-neutral-400)' }}>Enviados</span>
              <span style={{ fontSize: 13, color: 'var(--color-accent-300)' }}>
                {reminder.sentCount} de {reminder.maxRepeats}
              </span>
            </div>

            <span className="dg-note">
              Respeta tus horas de silencio: {quietLabel}. <Link href="/ajustes">Cambiar</Link>
            </span>
          </div>
        )}

        <div className="dg-setting">
          <div>
            <div className="dg-setting-name">Repetir el recordatorio</div>
            <div className="dg-setting-hint">
              {recurring
                ? `Cada ${recurrenceDays} días desde que lo completás`
                : 'Se archiva al marcarlo hecho'}
            </div>
          </div>
          <Toggle checked={recurring} onChange={setRecurring} label="Repetir el recordatorio" />
        </div>

        {recurring && (
          <div className="dg-setting">
            <span style={{ fontSize: 14, color: 'var(--color-neutral-400)' }}>Intervalo</span>
            <span className="dg-stepper">
              <button
                type="button"
                className="btn btn-secondary btn-icon"
                aria-label="Menos días"
                onClick={() => setRecurrenceDays(Math.max(1, recurrenceDays - 1))}
              >
                −
              </button>
              <span className="dg-stepper-value">{recurrenceDays} días</span>
              <button
                type="button"
                className="btn btn-secondary btn-icon"
                aria-label="Más días"
                onClick={() => setRecurrenceDays(Math.min(3650, recurrenceDays + 1))}
              >
                +
              </button>
            </span>
          </div>
        )}

        {log.length > 0 && (
          <div className="dg-field">
            <span className="dg-field-label">Últimos avisos</span>
            <div style={{ fontSize: 13, color: 'var(--color-neutral-400)', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {log.map((entry, index) => (
                <span key={index} style={{ color: entry.ok ? undefined : 'var(--color-neutral-600)' }}>
                  {entry.at} · {entry.device}
                  {!entry.ok && ' · falló'}
                </span>
              ))}
            </div>
          </div>
        )}

        {error && <div className="dg-error">{error}</div>}

        <div style={{ display: 'flex', gap: 9 }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{ flex: 1 }}
            disabled={busy}
            onClick={() => void action(`/api/reminders/${reminder.id}/done`, 'Hecho.', true)}
          >
            Marcar hecho
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ flex: 1 }}
            disabled={busy}
            onClick={() =>
              void action(`/api/reminders/${reminder.id}/snooze`, 'Pospuesto una hora.', false, { minutes: 60 })
            }
          >
            Posponer
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, paddingBottom: 40 }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ flex: 1 }}
            disabled={busy}
            onClick={() => void action(`/api/reminders/${reminder.id}/archivar`, 'Archivado.', true)}
          >
            Archivar
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ flex: 1, color: 'var(--color-neutral-400)' }}
            disabled={busy}
            onClick={() => {
              if (confirm(`¿Borrar "${reminder.title}"? No se puede deshacer.`)) void remove()
            }}
          >
            Borrar
          </button>
        </div>
      </div>
    </div>
  )
}

/** Same 18:00 / 09:00 rule the server uses for the quick-add chips. */
function resolveDue(choice: DueChoice, customDate: string): string | null {
  if (choice === 'none') return null
  const now = new Date()
  if (choice === 'hoy') {
    const today = new Date(now)
    today.setHours(18, 0, 0, 0)
    return (today > now ? today : new Date(now.getTime() + 10 * 60_000)).toISOString()
  }
  if (choice === 'manana') {
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(9, 0, 0, 0)
    return tomorrow.toISOString()
  }
  if (!customDate) return null
  return new Date(`${customDate}T09:00`).toISOString()
}

function step(steps: number[], current: number, direction: 1 | -1): number {
  const index = steps.findIndex((value) => value >= current)
  const base = index === -1 ? steps.length - 1 : index
  const next = Math.min(steps.length - 1, Math.max(0, base + direction))
  return steps[next]
}
