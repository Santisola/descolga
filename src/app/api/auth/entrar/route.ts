import { findUserByEmail, verifyPassword } from '@/lib/auth'
import { createSession } from '@/lib/session'
import { fail, ok, readJson, str } from '@/lib/api'

export async function POST(request: Request) {
  const body = await readJson<{ email?: string; password?: string }>(request)
  const email = str(body?.email, 200)
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!email || !password) return fail(400, 'Completá email y contraseña.')

  const user = await findUserByEmail(email)
  // Same message either way: a distinct "no existe esa cuenta" would let anyone
  // enumerate registered emails.
  const valid = user ? await verifyPassword(password, user.passwordHash) : false
  if (!user || !valid) return fail(401, 'Email o contraseña incorrectos.')

  await createSession(user.id)
  return ok({ user: { id: user.id, email: user.email } })
}
