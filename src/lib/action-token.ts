import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from './env'

/**
 * Notification actions ("Hecho" / "Posponer") are handled by the service worker
 * without opening the app. The SW's fetch carries the session cookie in the
 * normal case, but on iOS a long-dormant install can lose it — so each push also
 * ships a signed token that authorizes exactly one reminder and one action.
 */
export type ActionKind = 'done' | 'snooze'

function sign(payload: string): string {
  return createHmac('sha256', env.sessionSecret).update(payload).digest('base64url')
}

export function createActionToken(reminderId: string, kind: ActionKind, ttlMinutes = 60 * 24 * 7): string {
  const expiresAt = Date.now() + ttlMinutes * 60_000
  const payload = `${reminderId}.${kind}.${expiresAt}`
  return `${expiresAt}.${sign(payload)}`
}

export function verifyActionToken(token: string, reminderId: string, kind: ActionKind): boolean {
  const separator = token.indexOf('.')
  if (separator < 1) return false
  const expiresAt = Number(token.slice(0, separator))
  const signature = token.slice(separator + 1)
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false

  const expected = sign(`${reminderId}.${kind}.${expiresAt}`)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
