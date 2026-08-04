/**
 * Formatting shared by server and client components. Deliberately free of any
 * database or Node import so client bundles can pull it in.
 */

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/**
 * "60 min", "90 min", "2 h". Minutes stay minutes up to an hour and a half —
 * the design writes the default cadence as "cada 60 min", not "cada 1 h".
 */
export function describeInterval(minutes: number): string {
  if (minutes <= 90) return `${minutes} min`
  if (minutes % 60 === 0) return `${minutes / 60} h`
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

/** "2026-08-07" (an <input type="date"> value) -> "7 ago". */
export function formatDateInputShort(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12) return null
  return `${day} ${MONTHS_SHORT[month - 1]}`
}
