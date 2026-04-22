import { resolve } from 'node:path'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { createTaskBoardStore } from './store'
import { schema } from './schema'

let storePromise: Promise<ReturnType<typeof createTaskBoardStore>> | null = null

export async function getTaskBoardStore() {
  if (storePromise) {
    return storePromise
  }

  storePromise = (async () => {
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required for PostgreSQL.')
    }

    process.stderr.write('[db] connecting to postgres\n')
    const sql = postgres(databaseUrl, {
      max: 1,
    })

    const db = drizzle(sql, { schema })
    process.stderr.write('[db] running migrations\n')
    await migrate(db, {
      migrationsFolder: resolve(process.cwd(), 'drizzle'),
    })

    process.stderr.write('[db] database ready\n')
    return createTaskBoardStore(db)
  })().catch((err) => {
    storePromise = null
    process.stderr.write(
      `[db] failed to initialize database: ${err instanceof Error ? err.stack : String(err)}\n`,
    )
    throw err
  })

  return storePromise
}
