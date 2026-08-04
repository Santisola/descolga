'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Props = {
  mode: 'entrar' | 'registro'
  /** Where to land after success — used by the share-target hand-off. */
  next: string
}

/**
 * No screen in the design covers auth (the PRD only says "cuentas separadas"),
 * so this is built from the Nocturne vocabulary: one accent, fading rules, and
 * the same button set as the rest of the app.
 */
export function AuthForm({ mode, next }: Props) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSignUp = mode === 'registro'

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(isSignUp ? '/api/auth/registro' : '/api/auth/entrar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          // The account's timezone comes from the device that created it; quiet
          // hours are meaningless without one.
          timezone: isSignUp ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined,
        }),
      })
      const data = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) throw new Error(data.error ?? 'No se pudo continuar.')
      router.push(next)
      router.refresh()
    } catch (cause) {
      setError((cause as Error).message)
      setBusy(false)
    }
  }

  return (
    <main className="dg-auth">
      <div className="dg-brand">
        <span className="dg-brand-dot" />
        <span className="dg-brand-name">Descolgá</span>
      </div>

      <h1 style={{ fontSize: 27, margin: '0 0 8px' }}>
        {isSignUp ? 'Creá tu cuenta' : 'Entrá a tu lista'}
      </h1>
      <p style={{ fontSize: 15, color: 'var(--color-neutral-400)', margin: '0 0 22px', textWrap: 'pretty' }}>
        {isSignUp
          ? 'Anotás en dos segundos y el aviso insiste hasta que lo marcás hecho.'
          : 'Tus recordatorios te siguen entre el teléfono y la compu.'}
      </p>

      <form className="dg-form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            className="input"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            minLength={isSignUp ? 8 : undefined}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {isSignUp && <span className="dg-hint">Al menos 8 caracteres.</span>}
        </div>

        {error && <div className="dg-error">{error}</div>}

        <button type="submit" className="btn btn-primary btn-block" style={{ padding: 11 }} disabled={busy}>
          {busy ? 'Un segundo…' : isSignUp ? 'Crear cuenta' : 'Entrar'}
        </button>
      </form>

      <div className="dg-rule" />

      <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-400)' }}>
        {isSignUp ? (
          <>
            ¿Ya tenés cuenta? <Link href="/entrar">Entrá</Link>
          </>
        ) : (
          <>
            ¿Primera vez? <Link href="/crear-cuenta">Creá tu cuenta</Link>
          </>
        )}
      </p>
    </main>
  )
}
