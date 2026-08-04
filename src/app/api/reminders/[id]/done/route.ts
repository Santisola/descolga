import { authorizeReminderAction } from '@/lib/notification-actions'
import { completeReminder } from '@/lib/reminders'
import { fail, notFound, ok, readJson } from '@/lib/api'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const body = await readJson<{ token?: string }>(request)
  const token = body?.token ?? new URL(request.url).searchParams.get('token')

  const userId = await authorizeReminderAction(id, 'done', token ?? null)
  if (!userId) return fail(403, 'No autorizado para este recordatorio.')

  const reminder = await completeReminder(userId, id)
  if (!reminder) return notFound()

  // A recurrent reminder comes back as pending with its next date already set.
  return ok({ reminder, recurred: reminder.status === 'pending' })
}
