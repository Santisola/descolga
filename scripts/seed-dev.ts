/**
 * Fills the database with the scenario from the design canvas: one reminder
 * mid-insistence, one snoozed, a recurrent one, a couple of dateless ones, some
 * closed today, and two devices (one with a lapsed subscription).
 *
 *   npm run db:seed
 *
 * Works against DATABASE_URL when set, and against the PGlite dev database
 * otherwise — in that case stop `npm run dev` first, since PGlite allows a
 * single writer per data directory.
 */
import 'dotenv/config'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import * as schema from '../src/lib/db/schema'
import { notificationLog, pushSubscriptions, reminders, users } from '../src/lib/db/schema'
import { addDaysLocal, addMinutes } from '../src/lib/dates'

const TZ = 'America/Argentina/Buenos_Aires'
const EMAIL = 'nico@mail.com'
const PASSWORD = 'descolga2026'

type Db = Awaited<ReturnType<typeof open>>['db']

async function open() {
  const url = process.env.DATABASE_URL
  if (url) {
    const postgres = (await import('postgres')).default
    const { drizzle } = await import('drizzle-orm/postgres-js')
    const sql = postgres(url, { prepare: false, max: 1 })
    return { db: drizzle(sql, { schema }), close: () => sql.end(), label: 'Postgres remoto' }
  }

  const { PGlite } = await import('@electric-sql/pglite')
  const { drizzle } = await import('drizzle-orm/pglite')
  const client = new PGlite({ dataDir: join(process.cwd(), '.pglite') })
  await client.waitReady

  const migrationsDir = join(process.cwd(), 'drizzle')
  for (const file of readdirSync(migrationsDir).filter((n) => n.endsWith('.sql')).sort()) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8')
    for (const statement of sql.split('--> statement-breakpoint')) {
      if (!statement.trim()) continue
      try {
        await client.exec(statement)
      } catch (error) {
        if (!/already exists/i.test((error as Error).message)) throw error
      }
    }
  }

  return { db: drizzle(client, { schema }), close: () => client.close(), label: 'PGlite (./.pglite)' }
}

async function ensureUser(db: Db) {
  const [existing] = await db.select().from(users).where(eq(users.email, EMAIL)).limit(1)
  if (existing) return existing
  const [created] = await db
    .insert(users)
    .values({
      email: EMAIL,
      passwordHash: await bcrypt.hash(PASSWORD, 10),
      timezone: TZ,
      quietStartMinutes: 23 * 60,
      quietEndMinutes: 8 * 60,
      defaultInsistIntervalMinutes: 60,
      defaultMaxRepeats: 5,
    })
    .returning()
  return created
}

async function main() {
  const { db, close, label } = await open()
  console.log(`Sembrando en ${label}…`)

  const user = await ensureUser(db)
  const now = new Date()

  // Start from a clean slate so re-running is idempotent.
  await db.delete(reminders).where(eq(reminders.userId, user.id))
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, user.id))

  const today18 = addDaysLocal(now, TZ, 0, 18)
  const today20 = addDaysLocal(now, TZ, 0, 20)
  const inTwoDays = addDaysLocal(now, TZ, 2, 12)
  const inThreeDays = addDaysLocal(now, TZ, 3, 12)

  const [insisting] = await db
    .insert(reminders)
    .values({
      userId: user.id,
      title: 'Llevar el auto a lavar',
      notes: 'Antes del asado del sábado',
      dueAt: inThreeDays,
      notifyAt: addMinutes(now, -180),
      notifyMode: 'insist',
      insistIntervalMinutes: 60,
      maxRepeats: 5,
      // Mid-insistence: three avisos out, the next one due in ~20 minutes.
      sentCount: 3,
      lastNotifiedAt: addMinutes(now, -40),
    })
    .returning()

  await db.insert(reminders).values([
    {
      userId: user.id,
      title: 'Llamar a la veterinaria',
      dueAt: today18,
      notifyAt: today18,
      notifyMode: 'once',
    },
    {
      userId: user.id,
      title: 'Sacar la ropa del tender',
      dueAt: today20,
      notifyAt: today20,
      notifyMode: 'insist',
      status: 'snoozed',
      snoozedUntil: today20,
    },
    {
      userId: user.id,
      title: 'Cortarle las uñas a Nala',
      dueAt: inTwoDays,
      notifyAt: inTwoDays,
      notifyMode: 'once',
      recurrenceIntervalDays: 20,
    },
    { userId: user.id, title: 'Pagar el gas', dueAt: inThreeDays, notifyAt: inThreeDays },
    { userId: user.id, title: 'Renovar la SUBE', dueAt: inThreeDays, notifyAt: inThreeDays },
    { userId: user.id, title: 'Cambiar la lamparita del baño' },
    { userId: user.id, title: 'Devolver el taladro' },
    // Closed today — two of them had been insisting, which is what design 1k counts.
    {
      userId: user.id,
      title: 'Comprar pilas AA',
      status: 'done',
      completedAt: addMinutes(now, -90),
      notifyMode: 'insist',
      sentCount: 2,
    },
    {
      userId: user.id,
      title: 'Mandar la factura',
      status: 'done',
      completedAt: addMinutes(now, -200),
      notifyMode: 'insist',
      sentCount: 4,
    },
    { userId: user.id, title: 'Regar las plantas', status: 'done', completedAt: addMinutes(now, -300) },
    { userId: user.id, title: 'Buscar el paquete', status: 'done', completedAt: addMinutes(now, -420) },
    { userId: user.id, title: 'Cambiar el filtro del aire', status: 'archived' },
  ])

  const [phone] = await db
    .insert(pushSubscriptions)
    .values({
      userId: user.id,
      endpoint: 'https://web.push.apple.com/ejemplo-iphone-de-nico',
      p256dh: 'clave-de-ejemplo',
      auth: 'auth-de-ejemplo',
      deviceLabel: 'iPhone · Safari · instalada',
      lastSeenAt: addMinutes(now, -2),
    })
    .returning()

  await db.insert(pushSubscriptions).values({
    userId: user.id,
    endpoint: 'https://fcm.googleapis.com/ejemplo-macbook-chrome',
    p256dh: 'clave-de-ejemplo',
    auth: 'auth-de-ejemplo',
    deviceLabel: 'Mac · Chrome',
    lastSeenAt: addMinutes(now, -60 * 24 * 9),
    expiredAt: addMinutes(now, -60 * 24 * 2),
  })

  // The "Últimos avisos" list on the detail screen.
  await db.insert(notificationLog).values(
    [1, 2, 3].map((attempt) => ({
      reminderId: insisting.id,
      subscriptionId: phone.id,
      attempt,
      ok: true,
      sentAt: addMinutes(now, -40 - (3 - attempt) * 60),
    })),
  )

  console.log(`Listo. Entrá con ${EMAIL} / ${PASSWORD}`)
  await close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
