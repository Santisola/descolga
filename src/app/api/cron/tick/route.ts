import { timingSafeEqual } from 'node:crypto'
import { runTick } from '@/lib/scheduler'
import { env } from '@/lib/env'
import { fail, ok } from '@/lib/api'

// The scheduler needs the DB and web-push; never prerender or cache it.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorized(request: Request): boolean {
  const expected = env.cronSecret
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; QStash and the local
  // script can use the same header or `?secret=`.
  const header = request.headers.get('authorization') ?? ''
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : ''
  const provided = bearer || new URL(request.url).searchParams.get('secret') || ''
  if (provided.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
}

async function handle(request: Request) {
  if (!authorized(request)) return fail(401, 'Secreto de cron inválido.')
  try {
    return ok(await runTick())
  } catch (error) {
    console.error('[tick] falló', error)
    return fail(500, 'El tick falló.', { detail: (error as Error).message })
  }
}

export const GET = handle
export const POST = handle
