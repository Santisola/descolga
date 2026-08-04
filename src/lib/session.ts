import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import { env } from './env'

const COOKIE = 'descolga_session'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 90 // 90 días

function secret() {
  return new TextEncoder().encode(env.sessionSecret)
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret())

  const jar = await cookies()
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  })
}

export async function destroySession() {
  const jar = await cookies()
  jar.delete(COOKIE)
}

/** Returns the user id from the session cookie, or null. Never throws. */
export async function getSessionUserId(): Promise<string | null> {
  const jar = await cookies()
  const token = jar.get(COOKIE)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] })
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}
