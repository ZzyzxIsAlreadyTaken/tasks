import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { createTaskBoardStore } from './store'
import { schema } from './schema'

let store: ReturnType<typeof createTaskBoardStore> | null = null

export function getTaskBoardStore() {
  if (store) {
    return store
  }

  try {
    const dataDir = resolve(process.cwd(), '.data')
    mkdirSync(dataDir, { recursive: true })

    process.stderr.write(`[db] opening sqlite database in ${dataDir}\n`)
    const sqlite = new Database(resolve(dataDir, 'daily-task-board.sqlite'))
    sqlite.pragma('journal_mode = WAL')

    const db = drizzle(sqlite, { schema })
    process.stderr.write('[db] running migrations\n')
    migrate(db, {
      migrationsFolder: resolve(process.cwd(), 'drizzle'),
    })

    process.stderr.write('[db] database ready\n')
    store = createTaskBoardStore(db)
    return store
  } catch (err) {
    process.stderr.write(`[db] failed to initialize database: ${err instanceof Error ? err.stack : String(err)}\n`)
    throw err
  }
}
