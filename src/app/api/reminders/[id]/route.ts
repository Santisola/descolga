import { getApiUser } from '@/lib/auth'
import { deleteReminder, getReminder, updateReminder, type NotifyMode } from '@/lib/reminders'
import { fail, int, isoDate, notFound, ok, readJson, str, unauthorized } from '@/lib/api'

const MODES: NotifyMode[] = ['once', 'persistent', 'insist']

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const user = await getApiUser()
  if (!user) return unauthorized()
  const reminder = await getReminder(user.id, (await params).id)
  return reminder ? ok({ reminder }) : notFound()
}

export async function PATCH(request: Request, { params }: Params) {
  const user = await getApiUser()
  if (!user) return unauthorized()

  const body = await readJson<Record<string, unknown>>(request)
  if (!body) return fail(400, 'Cuerpo inválido.')

  const patch: Parameters<typeof updateReminder>[2] = {}

  if (body.title !== undefined) {
    const title = str(body.title, 300)
    if (!title) return fail(400, 'El título no puede quedar vacío.')
    patch.title = title
  }
  if (body.notes !== undefined) patch.notes = typeof body.notes === 'string' ? body.notes : null
  if (body.dueAt !== undefined) {
    const dueAt = isoDate(body.dueAt)
    if (dueAt === undefined) return fail(400, 'Fecha inválida.')
    patch.dueAt = dueAt
  }
  if (body.notifyMode !== undefined) {
    if (!MODES.includes(body.notifyMode as NotifyMode)) return fail(400, 'Modo de aviso inválido.')
    patch.notifyMode = body.notifyMode as NotifyMode
  }
  if (body.insistIntervalMinutes !== undefined) {
    const value = int(body.insistIntervalMinutes, 5, 60 * 24)
    if (value === null) return fail(400, 'La cadencia va entre 5 minutos y 24 horas.')
    patch.insistIntervalMinutes = value
  }
  if (body.maxRepeats !== undefined) {
    const value = int(body.maxRepeats, 1, 50)
    if (value === null) return fail(400, 'El tope va entre 1 y 50 avisos.')
    patch.maxRepeats = value
  }
  if (body.recurrenceIntervalDays !== undefined) {
    if (body.recurrenceIntervalDays === null) patch.recurrenceIntervalDays = null
    else {
      const value = int(body.recurrenceIntervalDays, 1, 3650)
      if (value === null) return fail(400, 'La recurrencia va entre 1 y 3650 días.')
      patch.recurrenceIntervalDays = value
    }
  }

  const reminder = await updateReminder(user.id, (await params).id, patch)
  return reminder ? ok({ reminder }) : notFound()
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await getApiUser()
  if (!user) return unauthorized()
  const deleted = await deleteReminder(user.id, (await params).id)
  return deleted ? ok({ ok: true }) : notFound()
}
