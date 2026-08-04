import { getApiUser } from '@/lib/auth'
import { buildPayload, sendToUser } from '@/lib/push'
import { fail, ok, unauthorized } from '@/lib/api'

/** "Probar aviso" in Ajustes — confirms the whole pipeline on this device. */
export async function POST() {
  const user = await getApiUser()
  if (!user) return unauthorized()

  const results = await sendToUser(
    user.id,
    buildPayload({
      reminderId: '00000000-0000-0000-0000-000000000000',
      title: 'Así te voy a insistir',
      body: 'Este es un aviso de prueba. Tocá Hecho para hacerlo desaparecer.',
      attempt: 1,
      maxRepeats: 1,
      persistent: false,
      withActions: true,
      snoozeMinutes: 60,
    }),
  )

  if (results.length === 0) return fail(409, 'Este dispositivo todavía no está suscrito a los avisos.')
  const delivered = results.filter((r) => r.ok).length
  if (delivered === 0) return fail(502, 'El servicio de push rechazó el envío.', { results })
  return ok({ delivered, total: results.length })
}
