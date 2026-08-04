import { destroySession } from '@/lib/session'
import { ok } from '@/lib/api'

export async function POST() {
  await destroySession()
  return ok({ ok: true })
}
