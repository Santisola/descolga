/**
 * `instrumentation.ts` is compiled for the edge runtime as well as node, and the
 * edge compilation rejects a static `node:fs` import even behind a runtime guard.
 * `process.getBuiltinModule` resolves it at runtime, invisibly to the bundler, so
 * the dev database can read the real migration files instead of carrying a
 * duplicated copy of the DDL.
 */
const { readFileSync, readdirSync } = process.getBuiltinModule('fs')

function join(...parts: string[]): string {
  return parts.join('/')
}

/**
 * Development fallback: when DATABASE_URL is empty, run the app against PGlite —
 * a real Postgres compiled to WASM, in this process, persisted under .pglite/.
 *
 * It exists so `npm run dev` works before anyone has a Neon URL. Production
 * always requires DATABASE_URL; this module is never reached there.
 */
export async function startDevDatabase(): Promise<void> {
  if (process.env.NODE_ENV === 'production') return
  if (process.env.DATABASE_URL) return

  const globalForDb = globalThis as unknown as { __descolgaDb?: unknown; __descolgaDevBooting?: Promise<void> }
  if (globalForDb.__descolgaDb) return
  if (globalForDb.__descolgaDevBooting) return globalForDb.__descolgaDevBooting

  globalForDb.__descolgaDevBooting = (async () => {
    const { PGlite } = await import('@electric-sql/pglite')
    const { drizzle } = await import('drizzle-orm/pglite')
    const schema = await import('./schema')

    const client = new PGlite({ dataDir: join(process.cwd(), '.pglite') })
    await client.waitReady

    // Migrations are idempotent here only because each statement is guarded;
    // drizzle-kit's SQL isn't, so swallow "already exists" and move on.
    const migrationsDir = join(process.cwd(), 'drizzle')
    const files = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort()
    for (const file of files) {
      const sql = readFileSync(join(migrationsDir, file), 'utf8')
      for (const statement of sql.split('--> statement-breakpoint')) {
        if (!statement.trim()) continue
        try {
          await client.exec(statement)
        } catch (error) {
          const message = (error as Error).message
          if (!/already exists/i.test(message)) throw error
        }
      }
    }

    globalForDb.__descolgaDb = drizzle(client, { schema })
    console.log('[descolga] DATABASE_URL vacía → usando PGlite en ./.pglite (solo desarrollo)')
  })()

  return globalForDb.__descolgaDevBooting
}
