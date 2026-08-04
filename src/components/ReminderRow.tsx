'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ReminderView } from '@/lib/view'
import { CheckIcon, ClockIcon, RepeatIcon } from './icons'
import { useToast } from './Toast'

type Props = {
  reminder: ReminderView
  /** Highlights the row that the desktop detail pane is showing. */
  active?: boolean
}

export function ReminderRow({ reminder, active = false }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [, startTransition] = useTransition()

  async function post(path: string, body?: unknown) {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string }
      throw new Error(data.error ?? 'No se pudo completar la acción.')
    }
    return response.json().catch(() => ({}))
  }

  async function complete() {
    if (busy) return
    setBusy(true)
    try {
      const result = (await post(`/api/reminders/${reminder.id}/done`)) as { recurred?: boolean }
      startTransition(() => router.refresh())
      if (result.recurred) {
        toast.show('Hecho. Este vuelve solo.')
      } else {
        toast.show('Hecho.', {
          label: 'Deshacer',
          run: () => {
            void post(`/api/reminders/${reminder.id}/reabrir`).then(() => router.refresh())
          },
        })
      }
    } catch (error) {
      toast.show((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function snooze() {
    if (busy) return
    setBusy(true)
    try {
      await post(`/api/reminders/${reminder.id}/snooze`, { minutes: 60 })
      startTransition(() => router.refresh())
      toast.show('Pospuesto una hora.')
    } catch (error) {
      toast.show((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const classes = ['dg-row']
  if (reminder.insisting) classes.push('dg-row--insisting')
  if (reminder.muted) classes.push('dg-row--muted')
  if (busy) classes.push('dg-row--busy')
  if (active) classes.push('dg-row--active')

  return (
    <div className={classes.join(' ')}>
      <button
        type="button"
        className="dg-check"
        aria-label={`Marcar "${reminder.title}" como hecho`}
        onClick={() => void complete()}
      >
        <span className="dg-check-circle">
          <CheckIcon size={13} />
        </span>
      </button>

      <button
        type="button"
        className="dg-row-main"
        onClick={() => router.push(`/r/${reminder.id}`)}
        aria-label={`Abrir ${reminder.title}`}
      >
        <span className="dg-row-title">{reminder.title}</span>

        {reminder.meta && (
          <span className="dg-row-meta dg-row-meta--accent">
            <span className="dg-pulse">
              <span className="dg-pulse-core" />
              <span className="dg-pulse-ring" />
            </span>
            {reminder.meta}
          </span>
        )}

        {reminder.sub && (
          <span className="dg-row-sub">
            {reminder.muted && <ClockIcon size={11} />} {reminder.sub}
          </span>
        )}

        {reminder.recurrence && (
          <span className="dg-row-sub">
            <RepeatIcon size={11} /> {reminder.recurrence}
          </span>
        )}
      </button>

      {reminder.dueShort && <span className="dg-row-due">{reminder.dueShort}</span>}

      {reminder.insisting && reminder.canSnooze && (
        <button type="button" className="btn btn-ghost dg-row-action" onClick={() => void snooze()}>
          Posponer
        </button>
      )}
    </div>
  )
}
