'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { registerServiceWorker, revalidatePush } from '@/lib/push-client'

/**
 * Runs once per app open on every authenticated screen:
 *   1. registers the service worker,
 *   2. revalidates this device's push subscription (iOS drops them), and
 *   3. refreshes the current route when the SW resolves a notification action,
 *      so a reminder marked done from the tray disappears from an open tab.
 */
export function PwaBootstrap({ vapidPublicKey }: { vapidPublicKey: string }) {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    void (async () => {
      await registerServiceWorker()
      if (cancelled) return
      await revalidatePush(vapidPublicKey)
    })()

    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: string } | null
      if (data?.type === 'descolga:refresh') router.refresh()
      if (data?.type === 'descolga:navigate' && data.url) router.push(data.url)
    }

    navigator.serviceWorker?.addEventListener('message', onMessage)

    // Coming back from the background is the other moment the list can be stale.
    const onVisible = () => {
      if (document.visibilityState === 'visible') router.refresh()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      navigator.serviceWorker?.removeEventListener('message', onMessage)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [router, vapidPublicKey])

  return null
}
