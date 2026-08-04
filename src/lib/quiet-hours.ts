import { addDaysLocal, minutesOfLocalDay, zonedTimeToInstant, localParts } from './dates'

export type QuietWindow = {
  timezone: string
  quietStartMinutes: number
  quietEndMinutes: number
}

/**
 * Quiet hours are a local wall-clock window that normally wraps midnight
 * (23:00 → 08:00). Start === end means "no quiet hours".
 */
export function isQuiet(now: Date, user: QuietWindow): boolean {
  const { quietStartMinutes: start, quietEndMinutes: end } = user
  if (start === end) return false
  const minute = minutesOfLocalDay(now, user.timezone)
  return start < end
    ? minute >= start && minute < end
    : minute >= start || minute < end
}

/**
 * The first instant at or after `now` when a push is allowed. Inside the quiet
 * window this is the local end of it; outside, it's `now` itself.
 */
export function nextAllowedInstant(now: Date, user: QuietWindow): Date {
  if (!isQuiet(now, user)) return now
  const { timezone, quietEndMinutes: end } = user
  const minute = minutesOfLocalDay(now, timezone)
  const hour = Math.floor(end / 60)
  const min = end % 60
  // If we're past the end time on the clock, the window wrapped midnight and the
  // end lands tomorrow; otherwise it's still today.
  const daysAhead = minute >= end ? 1 : 0
  if (daysAhead === 0) {
    const p = localParts(now, timezone)
    return zonedTimeToInstant(timezone, p.year, p.month, p.day, hour, min)
  }
  return addDaysLocal(now, timezone, 1, hour, min)
}
