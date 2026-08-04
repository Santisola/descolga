import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { getApiUser } from '@/lib/auth'
import { clockToMinutes } from '@/lib/dates'
import { fail, int, ok, readJson, str, unauthorized } from '@/lib/api'

type Body = {
  quietStart?: string
  quietEnd?: string
  defaultInsistIntervalMinutes?: number
  defaultMaxRepeats?: number
  reviewOnOpen?: boolean
  timezone?: string
}

export async function PATCH(request: Request) {
  const user = await getApiUser()
  if (!user) return unauthorized()

  const body = await readJson<Body>(request)
  if (!body) return fail(400, 'Cuerpo inválido.')

  const patch: Partial<typeof users.$inferInsert> = {}

  if (body.quietStart !== undefined) {
    const minutes = clockToMinutes(String(body.quietStart))
    if (minutes === null) return fail(400, 'Hora de inicio inválida (usá HH:MM).')
    patch.quietStartMinutes = minutes
  }
  if (body.quietEnd !== undefined) {
    const minutes = clockToMinutes(String(body.quietEnd))
    if (minutes === null) return fail(400, 'Hora de fin inválida (usá HH:MM).')
    patch.quietEndMinutes = minutes
  }
  if (body.defaultInsistIntervalMinutes !== undefined) {
    const value = int(body.defaultInsistIntervalMinutes, 5, 60 * 24)
    if (value === null) return fail(400, 'La cadencia va entre 5 minutos y 24 horas.')
    patch.defaultInsistIntervalMinutes = value
  }
  if (body.defaultMaxRepeats !== undefined) {
    const value = int(body.defaultMaxRepeats, 1, 50)
    if (value === null) return fail(400, 'El tope va entre 1 y 50 avisos.')
    patch.defaultMaxRepeats = value
  }
  if (body.reviewOnOpen !== undefined) patch.reviewOnOpen = body.reviewOnOpen === true
  if (body.timezone !== undefined) {
    const timezone = str(body.timezone, 80)
    if (!timezone) return fail(400, 'Zona horaria inválida.')
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone })
    } catch {
      return fail(400, 'Zona horaria desconocida.')
    }
    patch.timezone = timezone
  }

  if (Object.keys(patch).length === 0) return ok({ user: { id: user.id } })

  const [row] = await db.update(users).set(patch).where(eq(users.id, user.id)).returning()
  return ok({
    user: {
      id: row.id,
      quietStartMinutes: row.quietStartMinutes,
      quietEndMinutes: row.quietEndMinutes,
      defaultInsistIntervalMinutes: row.defaultInsistIntervalMinutes,
      defaultMaxRepeats: row.defaultMaxRepeats,
      reviewOnOpen: row.reviewOnOpen,
      timezone: row.timezone,
    },
  })
}
