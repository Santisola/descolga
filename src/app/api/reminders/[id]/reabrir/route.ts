import { getApiUser } from '@/lib/auth'
import { reopenReminder } from '@/lib/reminders'
import { notFound, ok, unauthorized } from '@/lib/api'

type Params = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: Params) {
  const user = await getApiUser()
  if (!user) return unauthorized()
  const reminder = await reopenReminder(user.id, (await params).id)
  return reminder ? ok({ reminder }) : notFound()
}
