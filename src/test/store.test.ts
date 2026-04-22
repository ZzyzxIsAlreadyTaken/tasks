import { resolve } from 'node:path'
import initSqlJs from 'sql.js'
import { drizzle } from 'drizzle-orm/sql-js'
import { migrate } from 'drizzle-orm/sql-js/migrator'
import { describe, expect, it } from 'vitest'
import { schema } from '~/db/schema'
import { createTaskBoardStore } from '~/db/store'

async function createHarness() {
  const SQL = await initSqlJs()
  const sqliteDb = new SQL.Database()
  const db = drizzle(sqliteDb, { schema })
  migrate(db, {
    migrationsFolder: resolve(process.cwd(), 'drizzle'),
  })
  const store = createTaskBoardStore(db)

  return {
    sqliteDb,
    store,
    cleanup() {
      sqliteDb.close()
    },
  }
}

describe('task board store', () => {
  it('creates, moves, and deletes tasks', async () => {
    const harness = await createHarness()
    await harness.store.seedDefaults()

    const board = await harness.store.getBoard('2026-04-15')
    const todoStatus = board.allStatuses.find((status) => status.name === 'Todo')
    const progressStatus = board.allStatuses.find(
      (status) => status.name === 'In Progress',
    )

    expect(todoStatus).toBeDefined()
    expect(progressStatus).toBeDefined()

    const taskId = await harness.store.saveTask({
      title: 'Write docs',
      description: 'Document the board',
      day: '2026-04-15',
      statusId: todoStatus!.id,
      categoryIds: board.allCategories.map((category) => category.id).slice(0, 1),
    })

    let updatedBoard = await harness.store.getBoard('2026-04-15')
    expect(updatedBoard.columns.flatMap((column) => column.tasks)).toHaveLength(1)

    await harness.store.saveTask({
      id: taskId,
      title: 'Write docs',
      description: 'Move it forward',
      day: '2026-04-16',
      statusId: progressStatus!.id,
      categoryIds: [],
    })

    updatedBoard = await harness.store.getBoard('2026-04-16')
    expect(updatedBoard.columns.find((column) => column.status.id === progressStatus!.id)?.tasks)
      .toHaveLength(1)

    await harness.store.deleteTask(taskId)
    updatedBoard = await harness.store.getBoard('2026-04-16')
    expect(updatedBoard.columns.flatMap((column) => column.tasks)).toHaveLength(0)

    harness.cleanup()
  })

  it('persists explicit order within each status column', async () => {
    const harness = await createHarness()
    await harness.store.seedDefaults()

    const board = await harness.store.getBoard('2026-04-15')
    const todoStatus = board.allStatuses.find((status) => status.name === 'Todo')!

    const firstTaskId = await harness.store.saveTask({
      title: 'First',
      description: '',
      day: '2026-04-15',
      statusId: todoStatus.id,
      categoryIds: [],
    })
    const secondTaskId = await harness.store.saveTask({
      title: 'Second',
      description: '',
      day: '2026-04-15',
      statusId: todoStatus.id,
      categoryIds: [],
    })

    await harness.store.saveBoardOrder({
      day: '2026-04-15',
      columns: [
        {
          statusId: todoStatus.id,
          taskIds: [secondTaskId, firstTaskId],
        },
        ...board.allStatuses
          .filter((status) => status.id !== todoStatus.id)
          .map((status) => ({
            statusId: status.id,
            taskIds: [],
          })),
      ],
    })

    const reordered = await harness.store.getBoard('2026-04-15')
    expect(
      reordered.columns
        .find((column) => column.status.id === todoStatus.id)
        ?.tasks.map((task) => task.title),
    ).toEqual(['Second', 'First'])

    harness.cleanup()
  })

  it('keeps archived statuses visible for existing tasks while blocking new assignment', async () => {
    const harness = await createHarness()
    await harness.store.seedDefaults()

    const board = await harness.store.getBoard('2026-04-15')
    const todoStatus = board.allStatuses.find((status) => status.name === 'Todo')!

    const taskId = await harness.store.saveTask({
      title: 'Legacy',
      description: '',
      day: '2026-04-15',
      statusId: todoStatus.id,
      categoryIds: [],
    })

    await harness.store.archiveStatus(todoStatus.id)

    const archivedBoard = await harness.store.getBoard('2026-04-15')
    expect(
      archivedBoard.columns.find((column) => column.status.id === todoStatus.id)?.status.isArchived,
    ).toBe(true)

    await expect(
      harness.store.saveTask({
        title: 'Should fail',
        description: '',
        day: '2026-04-15',
        statusId: todoStatus.id,
        categoryIds: [],
      }),
    ).rejects.toThrow('Archived statuses cannot receive new tasks.')

    await harness.store.saveTask({
      id: taskId,
      title: 'Legacy',
      description: 'Still editable',
      day: '2026-04-15',
      statusId: todoStatus.id,
      categoryIds: [],
    })

    harness.cleanup()
  })
})
