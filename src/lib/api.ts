import { NextResponse } from 'next/server'

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data as object, init)
}

export function fail(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...extra }, { status })
}

export const unauthorized = () => fail(401, 'No hay sesión activa.')
export const notFound = () => fail(404, 'No encontrado.')

export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T
  } catch {
    return null
  }
}

/** Trimmed non-empty string, capped — titles and notes come straight from users. */
export function str(value: unknown, maxLength = 500): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, maxLength)
}

export function int(value: unknown, min: number, max: number): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(n) || n < min || n > max) return null
  return n
}

/** Accepts an ISO string or null; rejects anything unparseable. */
export function isoDate(value: unknown): Date | null | undefined {
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}
