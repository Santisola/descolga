/* Descolgá — service worker.
 *
 * Two jobs, both from the PRD's notification pipeline:
 *   `push`              → show the aviso (fixed in the tray on Android)
 *   `notificationclick` → resolve "Hecho" / "Posponer" without opening the app
 *
 * PWAs cannot schedule local notifications for later, so everything here is
 * reactive: the backend's scheduler decides *when*, this file decides *how*.
 */

const OFFLINE_URL = '/offline.html'
const SHELL_CACHE = 'descolga-shell-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, '/icon.svg']))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

/**
 * Network-first for navigations, with an offline page as the floor. Reminder
 * data is never cached: a stale list is worse than no list for this product.
 */
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cache = await caches.open(SHELL_CACHE)
      return (await cache.match(OFFLINE_URL)) ?? Response.error()
    }),
  )
})

self.addEventListener('push', (event) => {
  let payload
  try {
    payload = event.data ? event.data.json() : null
  } catch {
    payload = null
  }
  if (!payload) return

  const actions = payload.withActions
    ? [
        { action: 'done', title: '✅ Hecho' },
        { action: 'snooze', title: '⏰ Posponer' },
      ]
    : []

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      // A stable tag makes each repeat *replace* the previous aviso instead of
      // stacking five copies in the tray.
      tag: payload.tag,
      renotify: true,
      // Android honours this and keeps the notification until it's acted on.
      // iOS ignores it — there, the repetition is what does the insisting.
      requireInteraction: Boolean(payload.requireInteraction),
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: payload,
      actions,
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  const payload = event.notification.data || {}
  const action = event.action

  event.notification.close()

  if (action === 'done' || action === 'snooze') {
    event.waitUntil(resolveFromNotification(action, payload))
    return
  }

  event.waitUntil(openApp(payload.url || '/pendientes'))
})

async function resolveFromNotification(action, payload) {
  const path =
    action === 'done'
      ? `/api/reminders/${payload.reminderId}/done`
      : `/api/reminders/${payload.reminderId}/snooze`

  const body =
    action === 'done'
      ? { token: payload.doneToken }
      : { token: payload.snoozeToken, minutes: payload.snoozeMinutes || 60 }

  try {
    const response = await fetch(path, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const result = await response.json().catch(() => ({}))
    await confirm(action, result)
    await refreshOpenTabs()
  } catch {
    // Never swallow a failed action silently — the whole promise of the product
    // is that "Hecho" actually lands. Fall back to opening the reminder.
    await self.registration.showNotification('No pude marcarlo', {
      body: 'Abrí Descolgá para resolverlo a mano.',
      tag: `${payload.tag || 'descolga'}-error`,
      data: { url: payload.url || '/pendientes' },
      icon: '/icon-192.png',
    })
  }
}

async function confirm(action, result) {
  if (action === 'snooze') {
    await flash('Pospuesto', 'Te vuelvo a avisar en un rato.')
    return
  }
  if (result && result.recurred && result.reminder && result.reminder.dueAt) {
    await flash('Hecho', 'Listo. Este vuelve solo en unos días.')
    return
  }
  await flash('Hecho', 'Sacado de la lista.')
}

/** A short-lived confirmation so the user sees the action took effect. */
async function flash(title, body) {
  const tag = 'descolga-confirm'
  await self.registration.showNotification(title, { body, tag, icon: '/icon-192.png', silent: true })
  await new Promise((resolve) => setTimeout(resolve, 3500))
  const open = await self.registration.getNotifications({ tag })
  open.forEach((notification) => notification.close())
}

async function refreshOpenTabs() {
  const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  clientList.forEach((client) => client.postMessage({ type: 'descolga:refresh' }))
}

async function openApp(url) {
  const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  for (const client of clientList) {
    if ('focus' in client) {
      client.postMessage({ type: 'descolga:navigate', url })
      return client.focus()
    }
  }
  return self.clients.openWindow(url)
}
