import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import initSqlJs from 'sql.js'
import { drizzle } from 'drizzle-orm/sql-js'
import { migrate } from 'drizzle-orm/sql-js/migrator'
import { createTaskBoardStore } from './store'
import { schema } from './schema'

let store: ReturnType<typeof createTaskBoardStore> | null = null

const DATA_DIR = resolve('/.data')
const DB_PATH = resolve(DATA_DIR, 'daily-task-board.sqlite')

function persistDb(sqliteDb: import('sql.js').Database) {
  const data = sqliteDb.export()
  writeFileSync(DB_PATH, Buffer.from(data))
}

export async function getTaskBoardStore() {
  if (store) {
    return store
  }

  try {
    mkdirSync(DATA_DIR, { recursive: true })

    const SQL = await initSqlJs()

    let sqliteDb: import('sql.js').Database
    if (existsSync(DB_PATH)) {
      process.stderr.write(`[db] loading existing sqlite database from ${DB_PATH}\n`)
      const fileBuffer = readFileSync(DB_PATH)
      sqliteDb = new SQL.Database(fileBuffer)
    } else {
      process.stderr.write(`[db] creating new sqlite database at ${DB_PATH}\n`)
      sqliteDb = new SQL.Database()
    }

    const db = drizzle(sqliteDb, { schema })
    process.stderr.write('[db] running migrations\n')
    migrate(db, {
      migrationsFolder: resolve(process.cwd(), 'drizzle'),
    })

    // Persist after migrations so schema changes are written to disk
    persistDb(sqliteDb)
    process.stderr.write('[db] database ready\n')

    store = createTaskBoardStore(db, () => persistDb(sqliteDb))
    return store
  } catch (err) {
    process.stderr.write(`[db] failed to initialize database: ${err instanceof Error ? err.stack : String(err)}\n`)
    throw err
  }
}
