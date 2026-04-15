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

  const dataDir = resolve(process.cwd(), '.data')
  mkdirSync(dataDir, { recursive: true })

  const sqlite = new Database(resolve(dataDir, 'daily-task-board.sqlite'))
  sqlite.pragma('journal_mode = WAL')

  const db = drizzle(sqlite, { schema })
  migrate(db, {
    migrationsFolder: resolve(process.cwd(), 'drizzle'),
  })

  store = createTaskBoardStore(db)
  return store
}
