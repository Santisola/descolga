import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { pushSubscriptions } from '@/lib/db/schema'
import { getApiUser } from '@/lib/auth'
import { fail, ok, readJson, str, unauthorized } from '@/lib/api'

type Body = {
  endpoint?: string
  keys?: { p256dh?: string; auth?: string }
  deviceLabel?: string
}

/**
 * Called on every app open, not just on first grant: iOS drops push
 * subscriptions after a stretch of inactivity, so re-registering the current one
 * is how a device stays reachable.
 */
export async function POST(request: Request) {
  const user = await getApiUser()
  if (!user) return unauthorized()

  const body = await readJson<Body>(request)
  const endpoint = str(body?.endpoint, 2000)
  const p256dh = str(body?.keys?.p256dh, 500)
  const auth = str(body?.keys?.auth, 500)
  if (!endpoint || !p256dh || !auth) return fail(400, 'Suscripción incompleta.')

  const deviceLabel = str(body?.deviceLabel, 80) ?? 'Este dispositivo'
  const now = new Date()

  await db
    .insert(pushSubscriptions)
    .values({ userId: user.id, endpoint, p256dh, auth, deviceLabel, lastSeenAt: now })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId: user.id, p256dh, auth, deviceLabel, lastSeenAt: now, expiredAt: null },
    })

  const subs = await db
    .select({
      id: pushSubscriptions.id,
      deviceLabel: pushSubscriptions.deviceLabel,
      expiredAt: pushSubscriptions.expiredAt,
    })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, user.id))

  return ok({ subscriptions: subs })
}

export async function DELETE(request: Request) {
  const user = await getApiUser()
  if (!user) return unauthorized()

  const body = await readJson<{ endpoint?: string; id?: string }>(request)
  const endpoint = str(body?.endpoint, 2000)
  const id = str(body?.id, 80)
  if (!endpoint && !id) return fail(400, 'Indicá el endpoint o el id.')

  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, user.id),
        id ? eq(pushSubscriptions.id, id) : eq(pushSubscriptions.endpoint, endpoint!),
      ),
    )

  return ok({ ok: true })
}
