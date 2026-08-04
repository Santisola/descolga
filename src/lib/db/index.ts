import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

type Db = PostgresJsDatabase<typeof schema>

// Next dev reloads the module graph on every edit, and `next build` imports every
// route module; without the global cache we'd leak a connection pool per reload,
// and without the lazy init a build with no DATABASE_URL would fail outright.
const globalForDb = globalThis as unknown as {
  __descolgaSql?: ReturnType<typeof postgres>
  __descolgaDb?: Db
}

function connect(): Db {
  if (globalForDb.__descolgaDb) return globalForDb.__descolgaDb

  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL no está definida. Copiá .env.example a .env y completala.')

  const sql =
    globalForDb.__descolgaSql ??
    postgres(url, {
      // Neon's pooler doesn't support prepared statements.
      prepare: false,
      max: 5,
      idle_timeout: 20,
    })

  const instance = drizzle(sql, { schema })

  if (process.env.NODE_ENV !== 'production') {
    globalForDb.__descolgaSql = sql
    globalForDb.__descolgaDb = instance
  }

  return instance
}

/**
 * The Drizzle client, connected on first use rather than on import. Everything
 * is forwarded to the real instance, with methods bound so `this` stays correct.
 */
export const db = new Proxy({} as Db, {
  get(_target, property) {
    const instance = connect() as unknown as Record<string | symbol, unknown>
    const value = instance[property]
    return typeof value === 'function' ? value.bind(instance) : value
  },
})

export { schema }
