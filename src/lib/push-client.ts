'use client'

/** Browser-side half of the push pipeline. Everything here is best-effort: iOS
 *  Safari only exposes push to an installed PWA, so each call has to degrade
 *  rather than throw. */

export type PushState =
  | 'unsupported' // no service worker / no Push API at all
  | 'needs-install' // iOS Safari in a browser tab: install first, then push
  | 'default' // supported, permission not asked yet
  | 'granted'
  | 'denied'

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports as a Mac; the touch points give it away.
    (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
  )
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari's non-standard flag, still the only reliable signal on iOS.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function pushState(): PushState {
  if (typeof window === 'undefined') return 'unsupported'
  const hasServiceWorker = 'serviceWorker' in navigator
  const hasPush = 'PushManager' in window
  if (!hasServiceWorker || !hasPush || typeof Notification === 'undefined') {
    // On iOS the APIs simply aren't there until the PWA is installed, so
    // distinguish "install me" from "your browser can't do this".
    return isIOS() && !isStandalone() ? 'needs-install' : 'unsupported'
  }
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return 'default'
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  } catch (error) {
    console.warn('[descolga] no se pudo registrar el service worker', error)
    return null
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalized)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

function deviceLabel(): string {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
  const platform = isIOS() ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Macintosh/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Escritorio'
  const browser = /CriOS|Chrome/.test(ua) ? 'Chrome' : /Firefox/.test(ua) ? 'Firefox' : /Safari/.test(ua) ? 'Safari' : 'Navegador'
  const installed = isStandalone() ? ' · instalada' : ''
  return `${platform} · ${browser}${installed}`
}

async function persist(subscription: PushSubscription): Promise<boolean> {
  const json = subscription.toJSON()
  const response = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
      deviceLabel: deviceLabel(),
    }),
  })
  return response.ok
}

/**
 * Ask for permission and subscribe. Returns the resulting state so the caller
 * can show the denied screen (design 1i) instead of guessing.
 */
export async function enablePush(vapidPublicKey: string): Promise<PushState> {
  const state = pushState()
  if (state === 'unsupported' || state === 'needs-install' || state === 'denied') return state

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'default'

  const registration = (await navigator.serviceWorker.getRegistration()) ?? (await registerServiceWorker())
  if (!registration) return 'unsupported'
  await navigator.serviceWorker.ready

  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    }))

  await persist(subscription)
  return 'granted'
}

/**
 * Re-send the current subscription on every app open. iOS drops subscriptions
 * after prolonged inactivity, and a stale endpoint fails silently — so the app
 * revalidates instead of trusting what the backend already has.
 */
export async function revalidatePush(vapidPublicKey: string): Promise<void> {
  if (pushState() !== 'granted') return
  const registration = (await navigator.serviceWorker.getRegistration()) ?? (await registerServiceWorker())
  if (!registration) return
  await navigator.serviceWorker.ready

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      })
    } catch (error) {
      console.warn('[descolga] no se pudo re-suscribir', error)
      return
    }
  }
  await persist(subscription)
}
