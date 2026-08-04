import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { findUserByEmail, hashPassword, normalizeEmail } from '@/lib/auth'
import { createSession } from '@/lib/session'
import { fail, ok, readJson, str } from '@/lib/api'

export async function POST(request: Request) {
  const body = await readJson<{ email?: string; password?: string; timezone?: string }>(request)
  const email = str(body?.email, 200)
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!email || !email.includes('@')) return fail(400, 'Ingresá un email válido.')
  if (password.length < 8) return fail(400, 'La contraseña necesita al menos 8 caracteres.')

  if (await findUserByEmail(email)) {
    return fail(409, 'Ya existe una cuenta con ese email.')
  }

  const timezone = str(body?.timezone, 80) ?? 'America/Argentina/Buenos_Aires'

  const [user] = await db
    .insert(users)
    .values({ email: normalizeEmail(email), passwordHash: await hashPassword(password), timezone })
    .returning({ id: users.id, email: users.email })

  await createSession(user.id)
  return ok({ user }, { status: 201 })
}
