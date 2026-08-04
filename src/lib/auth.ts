import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import { db } from './db'
import { users, type User } from './db/schema'
import { getSessionUserId } from './session'

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10)
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash)
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const [row] = await db.select().from(users).where(eq(users.email, normalizeEmail(email))).limit(1)
  return row
}

/** The signed-in user, or null. Use in layouts/pages that tolerate anonymity. */
export async function getCurrentUser(): Promise<User | null> {
  const userId = await getSessionUserId()
  if (!userId) return null
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  return row ?? null
}

/** The signed-in user, or a redirect to /entrar. For protected pages. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser()
  if (!user) redirect('/entrar')
  return user
}

/** The signed-in user, or null — for API routes that answer 401 themselves. */
export async function getApiUser(): Promise<User | null> {
  return getCurrentUser()
}
