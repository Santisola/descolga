import webpush, { type PushSubscription } from 'web-push'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from './db'
import { pushSubscriptions, type PushSubscriptionRow } from './db/schema'
import { env } from './env'
import { createActionToken } from './action-token'

let configured = false

function configure() {
  if (configured) return
  webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey)
  configured = true
}

/** What the service worker receives in the `push` event. */
export type PushPayload = {
  reminderId: string
  title: string
  body: string
  /** Stable per reminder, so a repeat replaces the previous notification. */
  tag: string
  /** Android keeps the notification in the tray until it's acted on. */
  requireInteraction: boolean
  /** Notification action buttons are Android-only; iOS ignores them. */
  withActions: boolean
  attempt: number
  maxRepeats: number
  snoozeMinutes: number
  doneToken: string
  snoozeToken: string
  url: string
}

export function buildPayload(input: {
  reminderId: string
  title: string
  body: string
  attempt: number
  maxRepeats: number
  persistent: boolean
  withActions: boolean
  snoozeMinutes: number
}): PushPayload {
  return {
    reminderId: input.reminderId,
    title: input.title,
    body: input.body,
    tag: `descolga-${input.reminderId}`,
    requireInteraction: input.persistent,
    withActions: input.withActions,
    attempt: input.attempt,
    maxRepeats: input.maxRepeats,
    snoozeMinutes: input.snoozeMinutes,
    doneToken: createActionToken(input.reminderId, 'done'),
    snoozeToken: createActionToken(input.reminderId, 'snooze'),
    url: `/r/${input.reminderId}`,
  }
}

function toWebPush(row: PushSubscriptionRow): PushSubscription {
  return { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }
}

export type DeliveryResult = {
  subscriptionId: string
  ok: boolean
  detail?: string
  /** The push service says this endpoint is gone; it was marked expired. */
  expired: boolean
}

export async function activeSubscriptions(userId: string) {
  return db
    .select()
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), isNull(pushSubscriptions.expiredAt)))
}

/**
 * Fan a payload out to every live subscription of one user. A 404/410 means the
 * browser dropped the subscription — mark it expired rather than retrying it
 * forever, and surface it in Ajustes so the user can re-subscribe.
 */
export async function sendToUser(userId: string, payload: PushPayload): Promise<DeliveryResult[]> {
  configure()
  const subs = await activeSubscriptions(userId)
  const body = JSON.stringify(payload)

  return Promise.all(
    subs.map(async (sub): Promise<DeliveryResult> => {
      try {
        await webpush.sendNotification(toWebPush(sub), body, { TTL: 60 * 60 })
        return { subscriptionId: sub.id, ok: true, expired: false }
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode
        const detail = `${statusCode ?? '?'} ${(error as Error).message}`.slice(0, 400)
        if (statusCode === 404 || statusCode === 410) {
          await db
            .update(pushSubscriptions)
            .set({ expiredAt: new Date() })
            .where(eq(pushSubscriptions.id, sub.id))
          return { subscriptionId: sub.id, ok: false, detail, expired: true }
        }
        return { subscriptionId: sub.id, ok: false, detail, expired: false }
      }
    }),
  )
}
