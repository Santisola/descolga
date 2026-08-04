import { getApiUser } from '@/lib/auth'
import { createReminder, listOpen, type NotifyMode } from '@/lib/reminders'
import { fail, int, isoDate, ok, readJson, str, unauthorized } from '@/lib/api'

const MODES: NotifyMode[] = ['once', 'persistent', 'insist']

export async function GET() {
  const user = await getApiUser()
  if (!user) return unauthorized()
  return ok({ reminders: await listOpen(user.id) })
}

export async function POST(request: Request) {
  const user = await getApiUser()
  if (!user) return unauthorized()

  const body = await readJson<Record<string, unknown>>(request)
  const title = str(body?.title, 300)
  if (!title) return fail(400, 'El recordatorio necesita un título.')

  const dueAt = isoDate(body?.dueAt)
  if (dueAt === undefined && body?.dueAt !== undefined) return fail(400, 'Fecha inválida.')

  const chip = body?.chip
  const notifyMode = MODES.includes(body?.notifyMode as NotifyMode)
    ? (body!.notifyMode as NotifyMode)
    : undefined

  const reminder = await createReminder(user, {
    title,
    notes: typeof body?.notes === 'string' ? body.notes : null,
    dueAt: dueAt === undefined ? undefined : dueAt,
    chip: chip === 'hoy' || chip === 'manana' ? chip : null,
    insist: body?.insist === true,
    notifyMode,
    insistIntervalMinutes: int(body?.insistIntervalMinutes, 5, 60 * 24) ?? undefined,
    maxRepeats: int(body?.maxRepeats, 1, 50) ?? undefined,
    recurrenceIntervalDays:
      body?.recurrenceIntervalDays === null ? null : (int(body?.recurrenceIntervalDays, 1, 3650) ?? undefined),
  })

  return ok({ reminder }, { status: 201 })
}
