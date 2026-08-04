/**
 * Timezone-aware date helpers built on Intl only — no date library.
 *
 * Everything stored in Postgres is an absolute instant (timestamptz). The user's
 * IANA zone is used to answer the two questions the product actually asks:
 * "what local wall-clock time is this?" (quiet hours, day grouping) and
 * "what instant does this local wall-clock time mean?" (the Hoy / Mañana chips).
 */

export type LocalParts = {
  year: number
  month: number // 1-12
  day: number
  hour: number
  minute: number
  second: number
}

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>()

function partsFormatter(timeZone: string) {
  let fmt = partsFormatterCache.get(timeZone)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    partsFormatterCache.set(timeZone, fmt)
  }
  return fmt
}

export function localParts(date: Date, timeZone: string): LocalParts {
  const parts = partsFormatter(timeZone).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? '0')
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  }
}

/** Zone offset in ms at `date` (positive east of UTC). */
function offsetMs(date: Date, timeZone: string): number {
  const p = localParts(date, timeZone)
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  // Drop sub-second precision on both sides so the difference is exactly the offset.
  return asIfUtc - Math.floor(date.getTime() / 1000) * 1000
}

/** The instant at which the given local wall-clock time occurs in `timeZone`. */
export function zonedTimeToInstant(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute)
  const firstGuess = new Date(naive - offsetMs(new Date(naive), timeZone))
  // One refinement pass settles DST transitions, where the offset at the guess
  // differs from the offset at the naive instant.
  const refined = new Date(naive - offsetMs(firstGuess, timeZone))
  return refined
}

/** Minutes elapsed since local midnight — the unit quiet hours are stored in. */
export function minutesOfLocalDay(date: Date, timeZone: string): number {
  const p = localParts(date, timeZone)
  return p.hour * 60 + p.minute
}

/** Local midnight that starts the day containing `date`. */
export function startOfLocalDay(date: Date, timeZone: string): Date {
  const p = localParts(date, timeZone)
  return zonedTimeToInstant(timeZone, p.year, p.month, p.day, 0, 0)
}

export function addDaysLocal(date: Date, timeZone: string, days: number, hour: number, minute = 0): Date {
  const p = localParts(date, timeZone)
  // Date.UTC normalizes overflow (day 32 -> next month), so this is safe.
  const shifted = new Date(Date.UTC(p.year, p.month - 1, p.day + days))
  const s = localParts(shifted, 'UTC')
  return zonedTimeToInstant(timeZone, s.year, s.month, s.day, hour, minute)
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000)
}

/** Whole local days between the two instants (b - a). Negative if b is earlier. */
export function localDayDiff(a: Date, b: Date, timeZone: string): number {
  const startA = startOfLocalDay(a, timeZone).getTime()
  const startB = startOfLocalDay(b, timeZone).getTime()
  return Math.round((startB - startA) / 86_400_000)
}

// ── Quick-add chip semantics ──────────────────────────────────────────────
// "Hoy" means the end of the working day, not this instant; if that moment has
// already passed, fall back to a few minutes out so the reminder still fires.
export const HOY_HOUR = 18
export const MANANA_HOUR = 9

export function chipToDueDate(
  chip: 'hoy' | 'manana' | null,
  timeZone: string,
  now = new Date(),
): Date | null {
  if (chip === null) return null
  if (chip === 'hoy') {
    const today = addDaysLocal(now, timeZone, 0, HOY_HOUR)
    return today.getTime() > now.getTime() ? today : addMinutes(now, 10)
  }
  return addDaysLocal(now, timeZone, 1, MANANA_HOUR)
}

// ── Display ───────────────────────────────────────────────────────────────

const WEEKDAYS_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const WEEKDAYS_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function localWeekdayIndex(date: Date, timeZone: string): number {
  const p = localParts(date, timeZone)
  return new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()
}

export function formatTime(date: Date, timeZone: string): string {
  const p = localParts(date, timeZone)
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`
}

export function formatDayMonth(date: Date, timeZone: string): string {
  const p = localParts(date, timeZone)
  return `${p.day} ${MONTHS_SHORT[p.month - 1]}`
}

export function weekdayShort(date: Date, timeZone: string): string {
  return WEEKDAYS_SHORT[localWeekdayIndex(date, timeZone)]
}

export function weekdayLong(date: Date, timeZone: string): string {
  return WEEKDAYS_LONG[localWeekdayIndex(date, timeZone)]
}

/** "Lunes 3 de agosto" — the list header. */
export function formatHeaderDate(date: Date, timeZone: string): string {
  const p = localParts(date, timeZone)
  const weekday = weekdayLong(date, timeZone)
  const MONTHS_LONG = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ]
  return `${weekday[0].toUpperCase()}${weekday.slice(1)} ${p.day} de ${MONTHS_LONG[p.month - 1]}`
}

/**
 * The short right-hand label in the list: "18:00", "jue", "vie", "3 ago",
 * "hace 2 h". Deliberately terse — the row's subtitle carries the detail.
 */
export function formatDueShort(due: Date, timeZone: string, now = new Date()): string {
  const days = localDayDiff(now, due, timeZone)
  if (days < 0) return days === -1 ? 'ayer' : `hace ${Math.abs(days)} d`
  if (days === 0) return formatTime(due, timeZone)
  if (days === 1) return 'mañana'
  if (days < 7) return weekdayShort(due, timeZone)
  return formatDayMonth(due, timeZone)
}

/** The row subtitle: "Hoy 18:00", "Vence el viernes", "Venció ayer". */
export function formatDueLong(due: Date, timeZone: string, now = new Date()): string {
  const days = localDayDiff(now, due, timeZone)
  if (days < 0) return days === -1 ? 'Venció ayer' : `Venció hace ${Math.abs(days)} días`
  if (days === 0) return `Hoy ${formatTime(due, timeZone)}`
  if (days === 1) return `Mañana ${formatTime(due, timeZone)}`
  if (days < 7) return `Vence el ${weekdayLong(due, timeZone)}`
  return `Vence el ${formatDayMonth(due, timeZone)}`
}

/** "en 4 h", "en 25 min", "hace 1 h" — used where a countdown reads better. */
export function formatRelative(target: Date, now = new Date()): string {
  const deltaMinutes = Math.round((target.getTime() - now.getTime()) / 60_000)
  const abs = Math.abs(deltaMinutes)
  const unit = abs < 60 ? `${abs} min` : abs < 60 * 48 ? `${Math.round(abs / 60)} h` : `${Math.round(abs / 1440)} d`
  return deltaMinutes >= 0 ? `en ${unit}` : `hace ${unit}`
}

/** 1380 -> "23:00". Quiet hours are stored as minutes from local midnight. */
export function minutesToClock(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export function clockToMinutes(clock: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(clock.trim())
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return hour * 60 + minute
}
