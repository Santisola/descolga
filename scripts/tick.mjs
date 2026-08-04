/**
 * Local stand-in for Vercel Cron / QStash: hits /api/cron/tick every minute so
 * the insistence pipeline actually runs in development.
 *
 *   npm run tick        # against http://localhost:3000
 *   APP_URL=https://… npm run tick
 */
import 'dotenv/config'

const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
const secret = process.env.CRON_SECRET

if (!secret) {
  console.error('Falta CRON_SECRET en .env — corré `npm run vapid` para generar uno.')
  process.exit(1)
}

const INTERVAL_MS = 60_000

async function tick() {
  const startedAt = new Date().toISOString()
  try {
    const response = await fetch(`${appUrl}/api/cron/tick`, {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      console.error(`${startedAt} ✗ ${response.status}`, body)
      return
    }
    const summary = `woken=${body.woken} considerados=${body.considered} enviados=${body.sent} silencio=${body.skippedQuiet} fallos=${body.failures}`
    console.log(`${startedAt} ✓ ${summary}`)
    for (const reminder of body.reminders ?? []) {
      console.log(`    · "${reminder.title}" aviso ${reminder.attempt} → ${reminder.deliveries} entrega(s)`)
    }
  } catch (error) {
    console.error(`${startedAt} ✗ no pude alcanzar ${appUrl}:`, error.message)
  }
}

console.log(`Scheduler local contra ${appUrl}, cada ${INTERVAL_MS / 1000}s. Ctrl+C para salir.`)
await tick()
setInterval(tick, INTERVAL_MS)
