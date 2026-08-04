/**
 * Runs once when the server process starts. Its only job is the development
 * database fallback — see src/lib/db/dev-pglite.ts.
 *
 * Every condition is checked *before* the import so that a production server, or
 * any server with a real DATABASE_URL, never loads that module at all.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NODE_ENV === 'production') return
  if (process.env.DATABASE_URL) return

  const { startDevDatabase } = await import('./lib/db/dev-pglite')
  await startDevDatabase()
}
