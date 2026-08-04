'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SettingsView } from '@/lib/view'
import { describeInterval } from '@/lib/format'
import { enablePush, pushState } from '@/lib/push-client'
import { Toggle } from './Toggle'
import { useToast } from './Toast'

export type DeviceView = {
  id: string
  label: string
  status: string
  active: boolean
}

type Props = {
  settings: SettingsView
  devices: DeviceView[]
  vapidPublicKey: string
}

const INTERVAL_STEPS = [5, 10, 15, 30, 45, 60, 90, 120, 180, 240, 360, 480, 720, 1440]

/** Design 1l: the three anti-molestia controls first, devices below. */
export function SettingsForm({ settings, devices, vapidPublicKey }: Props) {
  const router = useRouter()
  const toast = useToast()

  const [quietStart, setQuietStart] = useState(settings.quietStart)
  const [quietEnd, setQuietEnd] = useState(settings.quietEnd)
  const [interval, setInterval] = useState(settings.defaultInsistIntervalMinutes)
  const [maxRepeats, setMaxRepeats] = useState(settings.defaultMaxRepeats)
  const [reviewOnOpen, setReviewOnOpen] = useState(settings.reviewOnOpen)
  const [busy, setBusy] = useState(false)

  async function patch(body: Record<string, unknown>, message = 'Guardado.') {
    setBusy(true)
    try {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) throw new Error(data.error ?? 'No se pudo guardar.')
      toast.show(message)
      router.refresh()
    } catch (error) {
      toast.show((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function testPush() {
    setBusy(true)
    try {
      const response = await fetch('/api/push/test', { method: 'POST' })
      const data = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) throw new Error(data.error ?? 'No se pudo enviar.')
      toast.show('Aviso enviado a este dispositivo.')
    } catch (error) {
      toast.show((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function activateHere() {
    setBusy(true)
    const state = await enablePush(vapidPublicKey)
    setBusy(false)
    if (state === 'granted') {
      toast.show('Este dispositivo ya recibe avisos.')
      router.refresh()
    } else if (state === 'needs-install') {
      toast.show('En iPhone hace falta instalarla primero.')
    } else if (state === 'denied') {
      toast.show('El navegador bloqueó los avisos.')
    } else {
      toast.show('Este navegador no soporta avisos push.')
    }
  }

  async function removeDevice(id: string) {
    setBusy(true)
    try {
      const response = await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!response.ok) throw new Error('No se pudo quitar.')
      toast.show('Dispositivo quitado.')
      router.refresh()
    } catch (error) {
      toast.show((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    await fetch('/api/auth/salir', { method: 'POST' })
    router.push('/entrar')
    router.refresh()
  }

  const subscribedHere = typeof window !== 'undefined' && pushState() === 'granted'

  return (
    <div className="dg-section">
      <div className="dg-field">
        <span className="dg-field-label">No me molestes</span>

        <div className="dg-setting">
          <div>
            <div className="dg-setting-name">Horas de silencio</div>
            <div className="dg-setting-hint">No llegan avisos en esa ventana</div>
          </div>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
            <input
              type="time"
              className="input"
              style={{ width: 96 }}
              aria-label="Inicio del silencio"
              value={quietStart}
              disabled={busy}
              onChange={(event) => setQuietStart(event.target.value)}
              onBlur={() => quietStart !== settings.quietStart && void patch({ quietStart })}
            />
            <span style={{ color: 'var(--color-neutral-600)' }}>–</span>
            <input
              type="time"
              className="input"
              style={{ width: 96 }}
              aria-label="Fin del silencio"
              value={quietEnd}
              disabled={busy}
              onChange={(event) => setQuietEnd(event.target.value)}
              onBlur={() => quietEnd !== settings.quietEnd && void patch({ quietEnd })}
            />
          </span>
        </div>

        <div className="dg-setting">
          <div>
            <div className="dg-setting-name">Cadencia del insistir</div>
            <div className="dg-setting-hint">Valor por defecto de los nuevos</div>
          </div>
          <span className="dg-stepper">
            <button
              type="button"
              className="btn btn-secondary btn-icon"
              aria-label="Menos frecuente"
              disabled={busy}
              onClick={() => {
                const next = step(INTERVAL_STEPS, interval, -1)
                setInterval(next)
                void patch({ defaultInsistIntervalMinutes: next })
              }}
            >
              −
            </button>
            <span className="dg-stepper-value">{describeInterval(interval)}</span>
            <button
              type="button"
              className="btn btn-secondary btn-icon"
              aria-label="Más frecuente"
              disabled={busy}
              onClick={() => {
                const next = step(INTERVAL_STEPS, interval, 1)
                setInterval(next)
                void patch({ defaultInsistIntervalMinutes: next })
              }}
            >
              +
            </button>
          </span>
        </div>

        <div className="dg-setting">
          <div>
            <div className="dg-setting-name">Tope de avisos</div>
            <div className="dg-setting-hint">Después queda pendiente, sin insistir</div>
          </div>
          <span className="dg-stepper">
            <button
              type="button"
              className="btn btn-secondary btn-icon"
              aria-label="Menos avisos"
              disabled={busy}
              onClick={() => {
                const next = Math.max(1, maxRepeats - 1)
                setMaxRepeats(next)
                void patch({ defaultMaxRepeats: next })
              }}
            >
              −
            </button>
            <span className="dg-stepper-value">{maxRepeats}</span>
            <button
              type="button"
              className="btn btn-secondary btn-icon"
              aria-label="Más avisos"
              disabled={busy}
              onClick={() => {
                const next = Math.min(50, maxRepeats + 1)
                setMaxRepeats(next)
                void patch({ defaultMaxRepeats: next })
              }}
            >
              +
            </button>
          </span>
        </div>

        <div className="dg-setting">
          <div>
            <div className="dg-setting-name">Repaso al abrir la app</div>
            <div className="dg-setting-hint">Te muestro lo vencido en la pantalla, sin push</div>
          </div>
          <Toggle
            checked={reviewOnOpen}
            label="Repaso al abrir la app"
            disabled={busy}
            onChange={(next) => {
              setReviewOnOpen(next)
              void patch({ reviewOnOpen: next })
            }}
          />
        </div>
      </div>

      <div className="dg-rule" />

      <div className="dg-field">
        <span className="dg-field-label">Dispositivos</span>

        {devices.length === 0 && (
          <span className="dg-note">Todavía no hay ningún dispositivo recibiendo avisos.</span>
        )}

        {devices.map((device) => (
          <div
            key={device.id}
            className="card"
            style={{ padding: '13px 14px', flexDirection: 'row', alignItems: 'center', gap: 12 }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                flex: 'none',
                background: device.active ? 'var(--color-accent)' : 'var(--color-neutral-600)',
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15 }}>{device.label}</div>
              <div style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>{device.status}</div>
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: 12 }}
              disabled={busy}
              onClick={() => void removeDevice(device.id)}
            >
              Quitar
            </button>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginTop: 4 }}>
          {subscribedHere ? (
            <button type="button" className="btn btn-secondary" style={{ fontSize: 13 }} disabled={busy} onClick={() => void testPush()}>
              Probar aviso acá
            </button>
          ) : (
            <button type="button" className="btn btn-primary" style={{ fontSize: 13 }} disabled={busy} onClick={() => void activateHere()}>
              Activar avisos en este dispositivo
            </button>
          )}
        </div>
        <span className="dg-note">
          Una suscripción vencida se revalida sola cuando abrís Descolgá en ese dispositivo. Si no lo usás más,
          quitala.
        </span>
      </div>

      <div className="dg-rule" />

      <div className="dg-setting" style={{ paddingBottom: 48 }}>
        <div>
          <div className="dg-setting-name">{settings.email}</div>
          <div className="dg-setting-hint">Zona horaria: {settings.timezone}</div>
        </div>
        <button type="button" className="btn btn-secondary" style={{ fontSize: 13 }} onClick={() => void signOut()}>
          Salir
        </button>
      </div>
    </div>
  )
}

function step(steps: number[], current: number, direction: 1 | -1): number {
  const index = steps.findIndex((value) => value >= current)
  const base = index === -1 ? steps.length - 1 : index
  return steps[Math.min(steps.length - 1, Math.max(0, base + direction))]
}
