import { authorizeReminderAction } from '@/lib/notification-actions'
import { snoozeReminder } from '@/lib/reminders'
import { fail, int, notFound, ok, readJson } from '@/lib/api'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const body = await readJson<{ token?: string; minutes?: number }>(request)
  const url = new URL(request.url)
  const token = body?.token ?? url.searchParams.get('token')
  const minutes = int(body?.minutes ?? url.searchParams.get('minutes') ?? 60, 5, 60 * 24 * 30)
  if (minutes === null) return fail(400, 'Posponer va entre 5 minutos y 30 días.')

  const userId = await authorizeReminderAction(id, 'snooze', token ?? null)
  if (!userId) return fail(403, 'No autorizado para este recordatorio.')

  const reminder = await snoozeReminder(userId, id, minutes)
  return reminder ? ok({ reminder }) : notFound()
}
