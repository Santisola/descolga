import { eq } from 'drizzle-orm'
import { db } from './db'
import { reminders } from './db/schema'
import { getSessionUserId } from './session'
import { verifyActionToken, type ActionKind } from './action-token'

/**
 * Authorize a "Hecho" / "Posponer" hit that may arrive from the service worker
 * rather than the app. Two accepted proofs:
 *
 *  1. the session cookie (normal case — the SW's fetch is same-origin), or
 *  2. the signed single-purpose token that shipped inside the push payload,
 *     which keeps the buttons working on an install whose cookie has lapsed.
 *
 * Returns the owning user id, or null when neither proof holds.
 */
export async function authorizeReminderAction(
  reminderId: string,
  kind: ActionKind,
  token: string | null,
): Promise<string | null> {
  const sessionUserId = await getSessionUserId()

  const [reminder] = await db
    .select({ userId: reminders.userId })
    .from(reminders)
    .where(eq(reminders.id, reminderId))
    .limit(1)
  if (!reminder) return null

  if (sessionUserId && sessionUserId === reminder.userId) return reminder.userId
  if (token && verifyActionToken(token, reminderId, kind)) return reminder.userId
  return null
}
