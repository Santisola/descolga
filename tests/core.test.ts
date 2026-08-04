/**
 * Domain tests for the parts that are hard to eyeball: the insistence cadence,
 * quiet hours, snooze wake-up and completion-anchored recurrence.
 *
 * They run against a real Postgres — PGlite in-process — so the SQL, the enums
 * and the conditional "claim" update are all genuinely exercised.
 *
 *   npm test
 */
import { test, before, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { asc, eq } from 'drizzle-orm'

// The push layer configures VAPID eagerly, and action tokens need a signing key.
process.env.SESSION_SECRET ??= 'test-secret-please-do-not-use-in-production'
process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ??=
  'BGWPWsXrnqDmfHpQcnfIwm5Fi9PwzgCgc66MmKPOzUnhO0gTSyNRhDjjvwEusySXjTrz9s78GThMPO9tMHC2NGo'
process.env.VAPID_PRIVATE_KEY ??= '7duluz2XB6k7PF6BHzy1IKgodcRcjDOwMlWTpa6qLQg'

import * as schema from '../src/lib/db/schema'
import { notificationLog, reminders, users, type User } from '../src/lib/db/schema'
import { addMinutes, clockToMinutes, minutesToClock, zonedTimeToInstant } from '../src/lib/dates'
import { isQuiet, nextAllowedInstant } from '../src/lib/quiet-hours'
import { createActionToken, verifyActionToken } from '../src/lib/action-token'

const TZ = 'America/Argentina/Buenos_Aires'

// The db module reads this global before opening a connection, so seeding it
// here points the whole domain layer at PGlite with no production-code change.
const globalForDb = globalThis as unknown as { __descolgaDb?: unknown }

let db: ReturnType<typeof drizzle<typeof schema>>
let domain: typeof import('../src/lib/reminders')
let scheduler: typeof import('../src/lib/scheduler')

before(async () => {
  const client = new PGlite()
  db = drizzle(client, { schema })
  globalForDb.__descolgaDb = db

  const migrationsDir = join(import.meta.dirname, '..', 'drizzle')
  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8')
    for (const statement of sql.split('--> statement-breakpoint')) {
      if (statement.trim()) await client.exec(statement)
    }
  }

  // Imported after the global is set so the first db access finds PGlite.
  domain = await import('../src/lib/reminders')
  scheduler = await import('../src/lib/scheduler')
})

let userSeq = 0

async function makeUser(overrides: Partial<User> = {}): Promise<User> {
  userSeq += 1
  const [user] = await db
    .insert(users)
    .values({
      email: `test${userSeq}@descolga.app`,
      passwordHash: 'x',
      timezone: TZ,
      // Wide open by default; the quiet-hours tests set their own window.
      quietStartMinutes: 0,
      quietEndMinutes: 0,
      ...overrides,
    })
    .returning()
  return user
}

async function read(id: string) {
  const [row] = await db.select().from(reminders).where(eq(reminders.id, id)).limit(1)
  return row
}

describe('alta rápida', () => {
  test('sólo el título deja el recordatorio pendiente y sin aviso programado', async () => {
    const user = await makeUser()
    const reminder = await domain.createReminder(user, { title: '  Cambiar la lamparita  ' })

    assert.equal(reminder.title, 'Cambiar la lamparita')
    assert.equal(reminder.status, 'pending')
    assert.equal(reminder.notifyMode, 'once')
    assert.equal(reminder.dueAt, null)
    assert.equal(reminder.notifyAt, null)
    assert.equal(domain.nextFireAt(reminder), null, 'sin fecha y modo once: no debe disparar nunca')
  })

  test('insistir sin fecha arranca ya mismo y toma los defaults del usuario', async () => {
    const user = await makeUser({ defaultInsistIntervalMinutes: 30, defaultMaxRepeats: 3 })
    const reminder = await domain.createReminder(user, { title: 'Llevar el auto a lavar', insist: true })

    assert.equal(reminder.notifyMode, 'insist')
    assert.equal(reminder.insistIntervalMinutes, 30)
    assert.equal(reminder.maxRepeats, 3)
    assert.ok(reminder.notifyAt, 'insist sin fecha debe programar el primer aviso')
    assert.ok(domain.nextFireAt(reminder)!.getTime() <= Date.now() + 1000)
  })

  test('el chip Hoy cae a las 18:00 locales, o a +10 min si ya pasó', async () => {
    const user = await makeUser()
    const morning = zonedTimeToInstant(TZ, 2026, 8, 3, 9, 0)
    const evening = zonedTimeToInstant(TZ, 2026, 8, 3, 22, 0)

    const early = domain.buildNewReminder(user, { title: 'x', chip: 'hoy' }, morning)
    assert.equal(early.dueAt!.toISOString(), zonedTimeToInstant(TZ, 2026, 8, 3, 18, 0).toISOString())

    const late = domain.buildNewReminder(user, { title: 'x', chip: 'hoy' }, evening)
    assert.equal(late.dueAt!.getTime(), evening.getTime() + 10 * 60_000)

    const tomorrow = domain.buildNewReminder(user, { title: 'x', chip: 'manana' }, morning)
    assert.equal(tomorrow.dueAt!.toISOString(), zonedTimeToInstant(TZ, 2026, 8, 4, 9, 0).toISOString())
  })
})

describe('scheduler — la insistencia', () => {
  test('avisa, respeta la cadencia y se detiene en el tope', async () => {
    const user = await makeUser({ defaultInsistIntervalMinutes: 60, defaultMaxRepeats: 3 })
    const created = await domain.createReminder(user, { title: 'Llevar el auto a lavar', insist: true })
    const start = new Date(created.notifyAt!.getTime() + 1000)

    // The tick is global, so assert on this reminder rather than the totals —
    // other tests' rows live in the same database.
    const first = await scheduler.runTick(start)
    assert.ok(
      first.reminders.some((entry) => entry.id === created.id && entry.attempt === 1),
      'el tick debe reportar el aviso 1 de este recordatorio',
    )
    let row = await read(created.id)
    assert.equal(row.sentCount, 1, 'el primer tick debe mandar el aviso 1')

    // Same minute again: the interval hasn't elapsed, so nothing more goes out.
    await scheduler.runTick(new Date(start.getTime() + 30_000))
    row = await read(created.id)
    assert.equal(row.sentCount, 1, 'no debe repetir antes de que pase la cadencia')

    // Advance past the interval twice, then past the cap.
    await scheduler.runTick(addMinutes(start, 61))
    assert.equal((await read(created.id)).sentCount, 2)

    await scheduler.runTick(addMinutes(start, 122))
    row = await read(created.id)
    assert.equal(row.sentCount, 3)
    assert.equal(domain.isExhausted(row), true, 'alcanzado el tope, deja de insistir')

    await scheduler.runTick(addMinutes(start, 183))
    assert.equal((await read(created.id)).sentCount, 3, 'el tope es un tope')

    const log = await db
      .select()
      .from(notificationLog)
      .where(eq(notificationLog.reminderId, created.id))
      .orderBy(asc(notificationLog.attempt))
    assert.deepEqual(
      log.map((entry) => entry.attempt),
      [1, 2, 3],
      'cada aviso queda registrado una sola vez',
    )
  })

  test('dos ticks simultáneos no duplican el aviso', async () => {
    const user = await makeUser()
    const created = await domain.createReminder(user, { title: 'Pagar el gas', insist: true })
    const at = new Date(created.notifyAt!.getTime() + 1000)

    await Promise.all([scheduler.runTick(at), scheduler.runTick(at)])

    assert.equal((await read(created.id)).sentCount, 1, 'el claim condicional evita el doble envío')
  })

  test('modo "una vez" avisa una sola vez', async () => {
    const user = await makeUser()
    const due = new Date(Date.now() - 60_000)
    const created = await domain.createReminder(user, { title: 'Llamar a la veterinaria', dueAt: due })

    await scheduler.runTick(new Date())
    assert.equal((await read(created.id)).sentCount, 1)

    await scheduler.runTick(addMinutes(new Date(), 600))
    assert.equal((await read(created.id)).sentCount, 1)
  })

  test('las horas de silencio posponen el aviso sin consumirlo', async () => {
    // 23:00 → 08:00 local, and we tick at 02:00.
    const user = await makeUser({ quietStartMinutes: 1380, quietEndMinutes: 480 })
    const created = await domain.createReminder(user, { title: 'Sacar la basura', insist: true })

    const nightTime = zonedTimeToInstant(TZ, 2026, 8, 4, 2, 0)
    await db.update(reminders).set({ notifyAt: nightTime }).where(eq(reminders.id, created.id))

    const quietReport = await scheduler.runTick(new Date(nightTime.getTime() + 60_000))
    assert.equal(quietReport.skippedQuiet, 1)
    assert.equal(quietReport.sent, 0)
    assert.equal((await read(created.id)).sentCount, 0, 'nada se envía de madrugada')

    // 08:30, window over — the still-due reminder fires.
    const morning = zonedTimeToInstant(TZ, 2026, 8, 4, 8, 30)
    await scheduler.runTick(morning)
    assert.equal((await read(created.id)).sentCount, 1, 'al cerrar la ventana, sale el aviso pendiente')
  })

  test('un pospuesto vuelve a pendiente cuando se cumple el plazo', async () => {
    const user = await makeUser()
    const created = await domain.createReminder(user, { title: 'Sacar la ropa del tender', insist: true })

    const snoozed = await domain.snoozeReminder(user.id, created.id, 60)
    assert.equal(snoozed!.status, 'snoozed')
    assert.equal(snoozed!.sentCount, 0, 'posponer reinicia la cuenta de avisos')

    // Still snoozed: the scheduler must leave it alone.
    const early = await scheduler.runTick(addMinutes(new Date(), 30))
    assert.equal(early.woken, 0)
    assert.equal((await read(created.id)).status, 'snoozed')

    const late = await scheduler.runTick(addMinutes(new Date(), 61))
    assert.equal(late.woken, 1)
    assert.equal((await read(created.id)).status, 'pending')
  })
})

describe('completar y recurrencia', () => {
  test('un recordatorio simple se cierra', async () => {
    const user = await makeUser()
    const created = await domain.createReminder(user, { title: 'Renovar la SUBE' })

    const done = await domain.completeReminder(user.id, created.id)
    assert.equal(done!.status, 'done')
    assert.ok(done!.completedAt)
  })

  test('un recurrente se reagenda desde el completado, no desde la fecha vieja', async () => {
    const user = await makeUser()
    const oldDue = new Date(Date.now() - 5 * 86_400_000) // venció hace 5 días
    const created = await domain.createReminder(user, {
      title: 'Cortarle las uñas a Nala',
      dueAt: oldDue,
      insist: true,
      recurrenceIntervalDays: 20,
    })
    await scheduler.runTick(new Date())
    assert.equal((await read(created.id)).sentCount, 1)

    const completedAt = Date.now()
    const next = await domain.completeReminder(user.id, created.id)

    assert.equal(next!.status, 'pending', 'un recurrente no se cierra: vuelve')
    assert.equal(next!.sentCount, 0, 'la cuenta de avisos arranca de cero')
    assert.equal(next!.lastNotifiedAt, null)

    const expected = completedAt + 20 * 86_400_000
    assert.ok(
      Math.abs(next!.dueAt!.getTime() - expected) < 5_000,
      'la próxima fecha se cuenta desde el completado, no desde el vencimiento anterior',
    )
  })

  test('editar la cadencia reinicia la insistencia gastada', async () => {
    const user = await makeUser({ defaultMaxRepeats: 1 })
    const created = await domain.createReminder(user, { title: 'Devolver el taladro', insist: true })
    await scheduler.runTick(new Date(created.notifyAt!.getTime() + 1000))

    let row = await read(created.id)
    assert.equal(domain.isExhausted(row), true)

    const updated = await domain.updateReminder(user.id, created.id, { maxRepeats: 4 })
    assert.equal(updated!.sentCount, 0, 'subir el tope debe volver a habilitar los avisos')
    assert.equal(updated!.lastNotifiedAt, null)

    await scheduler.runTick(addMinutes(new Date(), 1))
    row = await read(created.id)
    assert.equal(row.sentCount, 1)
  })
})

describe('horas de silencio', () => {
  test('la ventana que cruza medianoche se evalúa en hora local', () => {
    const user = { timezone: TZ, quietStartMinutes: 1380, quietEndMinutes: 480 }

    assert.equal(isQuiet(zonedTimeToInstant(TZ, 2026, 8, 3, 23, 30), user), true)
    assert.equal(isQuiet(zonedTimeToInstant(TZ, 2026, 8, 4, 3, 0), user), true)
    assert.equal(isQuiet(zonedTimeToInstant(TZ, 2026, 8, 4, 7, 59), user), true)
    assert.equal(isQuiet(zonedTimeToInstant(TZ, 2026, 8, 4, 8, 0), user), false)
    assert.equal(isQuiet(zonedTimeToInstant(TZ, 2026, 8, 4, 14, 0), user), false)
  })

  test('start === end significa "sin horas de silencio"', () => {
    const user = { timezone: TZ, quietStartMinutes: 0, quietEndMinutes: 0 }
    assert.equal(isQuiet(zonedTimeToInstant(TZ, 2026, 8, 4, 3, 0), user), false)
  })

  test('el próximo instante permitido es el cierre de la ventana', () => {
    const user = { timezone: TZ, quietStartMinutes: 1380, quietEndMinutes: 480 }

    // 02:00 → esta misma mañana a las 08:00
    const madrugada = zonedTimeToInstant(TZ, 2026, 8, 4, 2, 0)
    assert.equal(
      nextAllowedInstant(madrugada, user).toISOString(),
      zonedTimeToInstant(TZ, 2026, 8, 4, 8, 0).toISOString(),
    )

    // 23:30 → mañana a las 08:00
    const noche = zonedTimeToInstant(TZ, 2026, 8, 3, 23, 30)
    assert.equal(
      nextAllowedInstant(noche, user).toISOString(),
      zonedTimeToInstant(TZ, 2026, 8, 4, 8, 0).toISOString(),
    )

    // Fuera de la ventana, ahora mismo.
    const tarde = zonedTimeToInstant(TZ, 2026, 8, 4, 14, 0)
    assert.equal(nextAllowedInstant(tarde, user).getTime(), tarde.getTime())
  })

  test('el reloj ida y vuelta', () => {
    assert.equal(minutesToClock(1380), '23:00')
    assert.equal(minutesToClock(480), '08:00')
    assert.equal(clockToMinutes('23:00'), 1380)
    assert.equal(clockToMinutes('08:00'), 480)
    assert.equal(clockToMinutes('24:00'), null)
    assert.equal(clockToMinutes('nope'), null)
  })
})

describe('tokens de acción de las notificaciones', () => {
  test('sólo valen para su recordatorio y su acción', () => {
    const token = createActionToken('abc', 'done')

    assert.equal(verifyActionToken(token, 'abc', 'done'), true)
    assert.equal(verifyActionToken(token, 'abc', 'snooze'), false, 'no debe servir para posponer')
    assert.equal(verifyActionToken(token, 'otro', 'done'), false, 'no debe servir para otro recordatorio')
    assert.equal(verifyActionToken('basura', 'abc', 'done'), false)
  })

  test('un token vencido no se acepta', () => {
    const expired = createActionToken('abc', 'done', -1)
    assert.equal(verifyActionToken(expired, 'abc', 'done'), false)
  })
})

describe('agrupado de la lista', () => {
  test('lo que insiste va primero, después vencido, hoy, la semana y sin fecha', async () => {
    const user = await makeUser()
    const now = zonedTimeToInstant(TZ, 2026, 8, 4, 12, 0)

    const insisting = await domain.createReminder(user, { title: 'insistiendo', insist: true })
    await db.update(reminders).set({ sentCount: 2 }).where(eq(reminders.id, insisting.id))

    const overdue = await domain.createReminder(user, {
      title: 'atrasado',
      dueAt: zonedTimeToInstant(TZ, 2026, 8, 1, 10, 0),
    })
    const today = await domain.createReminder(user, {
      title: 'hoy',
      dueAt: zonedTimeToInstant(TZ, 2026, 8, 4, 18, 0),
    })
    const thisWeek = await domain.createReminder(user, {
      title: 'semana',
      dueAt: zonedTimeToInstant(TZ, 2026, 8, 7, 10, 0),
    })
    const undated = await domain.createReminder(user, { title: 'sin fecha' })

    const rows = await domain.listOpen(user.id)
    const groups = domain.groupReminders(rows, user.timezone, now)

    assert.deepEqual(
      groups.map((group) => group.key),
      ['insistiendo', 'atrasado', 'hoy', 'semana', 'sinFecha'],
    )
    assert.deepEqual(
      groups.map((group) => group.items.map((item) => item.id)),
      [[insisting.id], [overdue.id], [today.id], [thisWeek.id], [undated.id]],
    )
  })
})
