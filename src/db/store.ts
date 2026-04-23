import { and, asc, count, eq, inArray, sql } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { categories, schema, statuses, taskCategories, tasks } from './schema'
import { assertIsoDate } from '~/lib/dates'
import type {
  BoardSnapshot,
  CategoryRecord,
  OverviewSnapshot,
  SaveBoardOrderInput,
  SettingsSnapshot,
  StatusRecord,
  TaskDraft,
  TaskRecord,
  UpsertCategoryInput,
  UpsertStatusInput,
} from '~/lib/task-board'

type Database = PostgresJsDatabase<typeof schema>

const DEFAULT_STATUSES = [
  { name: 'Todo', color: '#d97706' },
  { name: 'In Progress', color: '#2563eb' },
  { name: 'Done', color: '#15803d' },
]

const DEFAULT_CATEGORIES = [
  { name: 'Work', color: '#0f766e' },
  { name: 'Personal', color: '#c2410c' },
]

function nowIsoTimestamp() {
  return new Date().toISOString()
}

function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`
}

async function replaceTaskCategories(
  db: Database,
  taskId: string,
  categoryIds: string[],
) {
  await db.delete(taskCategories).where(eq(taskCategories.taskId, taskId))

  if (categoryIds.length === 0) {
    return
  }

  await db.insert(taskCategories).values(
    [...new Set(categoryIds)].map((categoryId) => ({
      taskId,
      categoryId,
    })),
  )
}

async function getNextPosition(
  db: Database,
  day: string,
  statusId: string,
) {
  const result = await db
    .select({
      maxPosition: sql<number>`coalesce(max(${tasks.position}), -1)`,
    })
    .from(tasks)
    .where(and(eq(tasks.day, day), eq(tasks.statusId, statusId)))

  return (result[0]?.maxPosition ?? -1) + 1
}

function groupCategoriesByTask(
  rows: Array<{
    taskId: string
    id: string
    name: string
    color: string | null
    position: number
    isArchived: boolean
  }>,
) {
  return rows.reduce<Record<string, CategoryRecord[]>>((acc, row) => {
    acc[row.taskId] ??= []
    acc[row.taskId].push({
      id: row.id,
      name: row.name,
      color: row.color,
      position: row.position,
      isArchived: row.isArchived,
    })
    return acc
  }, {})
}

export function createTaskBoardStore(db: Database) {
  return {
    async seedDefaults() {
      const statusCount = await db.select({ value: count() }).from(statuses)
      if ((statusCount[0]?.value ?? 0) === 0) {
        await db.insert(statuses).values(
          DEFAULT_STATUSES.map((status, index) => ({
            id: makeId('status'),
            name: status.name,
            color: status.color,
            position: index,
            isArchived: false,
          })),
        )
      }

      const categoryCount = await db.select({ value: count() }).from(categories)
      if ((categoryCount[0]?.value ?? 0) === 0) {
        await db.insert(categories).values(
          DEFAULT_CATEGORIES.map((category, index) => ({
            id: makeId('category'),
            name: category.name,
            color: category.color,
            position: index,
            isArchived: false,
          })),
        )
      }
    },

    async getBoard(day: string): Promise<BoardSnapshot> {
      assertIsoDate(day)

      const allStatuses = await db
        .select()
        .from(statuses)
        .orderBy(asc(statuses.position), asc(statuses.name))
      const activeCategories = await db
        .select()
        .from(categories)
        .where(eq(categories.isArchived, false))
        .orderBy(asc(categories.position), asc(categories.name))
      const dayTasks = await db
        .select()
        .from(tasks)
        .where(eq(tasks.day, day))
        .orderBy(asc(tasks.position), asc(tasks.createdAt))

      const dayTaskIds = dayTasks.map((task) => task.id)
      const categoryRows =
        dayTaskIds.length > 0
          ? await db
              .select({
                taskId: taskCategories.taskId,
                id: categories.id,
                name: categories.name,
                color: categories.color,
                position: categories.position,
                isArchived: categories.isArchived,
              })
              .from(taskCategories)
              .innerJoin(categories, eq(taskCategories.categoryId, categories.id))
              .where(inArray(taskCategories.taskId, dayTaskIds))
              .orderBy(asc(categories.position), asc(categories.name))
          : []

      const categoriesByTask = groupCategoriesByTask(categoryRows)
      const taskList: TaskRecord[] = dayTasks.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        day: task.day,
        statusId: task.statusId,
        position: task.position,
        categories: categoriesByTask[task.id] ?? [],
      }))

      const visibleStatuses = allStatuses.filter(
        (status) =>
          !status.isArchived ||
          taskList.some((task) => task.statusId === status.id),
      )

      return {
        day,
        columns: visibleStatuses.map((status) => ({
          status,
          tasks: taskList.filter((task) => task.statusId === status.id),
        })),
        allStatuses,
        allCategories: activeCategories,
      }
    },

    async getOverview(): Promise<OverviewSnapshot> {
      const allStatuses = await db
        .select()
        .from(statuses)
        .orderBy(asc(statuses.position), asc(statuses.name))
      const activeCategories = await db
        .select()
        .from(categories)
        .where(eq(categories.isArchived, false))
        .orderBy(asc(categories.position), asc(categories.name))
      const allTasks = await db
        .select()
        .from(tasks)
        .orderBy(asc(tasks.day), asc(tasks.position), asc(tasks.createdAt))

      const taskIds = allTasks.map((task) => task.id)
      const categoryRows =
        taskIds.length > 0
          ? await db
              .select({
                taskId: taskCategories.taskId,
                id: categories.id,
                name: categories.name,
                color: categories.color,
                position: categories.position,
                isArchived: categories.isArchived,
              })
              .from(taskCategories)
              .innerJoin(categories, eq(taskCategories.categoryId, categories.id))
              .where(inArray(taskCategories.taskId, taskIds))
              .orderBy(asc(categories.position), asc(categories.name))
          : []
      const categoriesByTask = groupCategoriesByTask(categoryRows)
      const statusById = new Map(allStatuses.map((status) => [status.id, status]))

      return {
        tasks: allTasks.map((task) => ({
          id: task.id,
          title: task.title,
          description: task.description,
          day: task.day,
          statusId: task.statusId,
          position: task.position,
          categories: categoriesByTask[task.id] ?? [],
          status: statusById.get(task.statusId) ?? null,
        })),
        statuses: allStatuses,
        categories: activeCategories,
      }
    },

    async saveTask(task: TaskDraft) {
      assertIsoDate(task.day)

      const title = task.title.trim()
      if (!title) {
        throw new Error('Task title is required.')
      }

      const existing = task.id
        ? await db.select().from(tasks).where(eq(tasks.id, task.id)).limit(1)
        : []

      const currentTask = existing[0] ?? null
      const status = await db
        .select()
        .from(statuses)
        .where(eq(statuses.id, task.statusId))
        .limit(1)

      if (!status[0]) {
        throw new Error('Please choose a valid status.')
      }

      if (status[0].isArchived && currentTask?.statusId !== task.statusId) {
        throw new Error('Archived statuses cannot receive new tasks.')
      }

      const activeCategories = await db
        .select()
        .from(categories)
        .where(
          inArray(
            categories.id,
            task.categoryIds.length === 0 ? ['__none__'] : task.categoryIds,
          ),
        )

      const existingCategoryRows = currentTask
        ? await db
            .select({ categoryId: taskCategories.categoryId })
            .from(taskCategories)
            .where(eq(taskCategories.taskId, currentTask.id))
        : []
      const existingCategoryIds = new Set(
        existingCategoryRows.map((row) => row.categoryId),
      )

      if (
        activeCategories.some(
          (category) =>
            category.isArchived && !existingCategoryIds.has(category.id),
        )
      ) {
        throw new Error('Archived categories cannot be assigned to new work.')
      }

      const timestamp = nowIsoTimestamp()
      if (task.id) {
        if (!currentTask) {
          throw new Error('Task not found.')
        }

        const nextPosition =
          currentTask.day === task.day && currentTask.statusId === task.statusId
            ? currentTask.position
            : await getNextPosition(db, task.day, task.statusId)

        await db
          .update(tasks)
          .set({
            title,
            description: task.description.trim() || null,
            day: task.day,
            statusId: task.statusId,
            position: nextPosition,
            updatedAt: timestamp,
          })
          .where(eq(tasks.id, task.id))

        await replaceTaskCategories(db, task.id, task.categoryIds)
        return task.id
      }

      const taskId = makeId('task')
      await db.insert(tasks).values({
        id: taskId,
        title,
        description: task.description.trim() || null,
        day: task.day,
        statusId: task.statusId,
        position: await getNextPosition(db, task.day, task.statusId),
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      await replaceTaskCategories(db, taskId, task.categoryIds)
      return taskId
    },

    async deleteTask(taskId: string) {
      await db.delete(tasks).where(eq(tasks.id, taskId))
    },

    async saveBoardOrder(input: SaveBoardOrderInput) {
      assertIsoDate(input.day)

      for (const column of input.columns) {
        for (const [position, taskId] of column.taskIds.entries()) {
          await db
            .update(tasks)
            .set({
              day: input.day,
              statusId: column.statusId,
              position,
              updatedAt: nowIsoTimestamp(),
            })
            .where(eq(tasks.id, taskId))
        }
      }
    },

    async getSettings(): Promise<SettingsSnapshot> {
      const statusRows = await db
        .select({
          id: statuses.id,
          name: statuses.name,
          color: statuses.color,
          position: statuses.position,
          isArchived: statuses.isArchived,
          taskCount: count(tasks.id),
        })
        .from(statuses)
        .leftJoin(tasks, eq(tasks.statusId, statuses.id))
        .groupBy(statuses.id)
        .orderBy(asc(statuses.position), asc(statuses.name))

      const categoryRows = await db
        .select({
          id: categories.id,
          name: categories.name,
          color: categories.color,
          position: categories.position,
          isArchived: categories.isArchived,
          taskCount: count(taskCategories.taskId),
        })
        .from(categories)
        .leftJoin(taskCategories, eq(taskCategories.categoryId, categories.id))
        .groupBy(categories.id)
        .orderBy(asc(categories.position), asc(categories.name))

      return {
        statuses: statusRows,
        categories: categoryRows,
      }
    },

    async upsertStatus(input: UpsertStatusInput) {
      const name = input.name.trim()
      if (!name) {
        throw new Error('Status name is required.')
      }

      if (input.id) {
        await db
          .update(statuses)
          .set({
            name,
            color: input.color,
          })
          .where(eq(statuses.id, input.id))
        return input.id
      }

      const countResult = await db.select({ value: count() }).from(statuses)
      const id = makeId('status')
      await db.insert(statuses).values({
        id,
        name,
        color: input.color,
        position: countResult[0]?.value ?? 0,
        isArchived: false,
      })
      return id
    },

    async reorderStatuses(statusIds: string[]) {
      for (const [position, id] of statusIds.entries()) {
        await db.update(statuses).set({ position }).where(eq(statuses.id, id))
      }
    },

    async archiveStatus(statusId: string) {
      await db
        .update(statuses)
        .set({
          isArchived: true,
        })
        .where(eq(statuses.id, statusId))
    },

    async upsertCategory(input: UpsertCategoryInput) {
      const name = input.name.trim()
      if (!name) {
        throw new Error('Category name is required.')
      }

      if (input.id) {
        await db
          .update(categories)
          .set({
            name,
            color: input.color ?? null,
          })
          .where(eq(categories.id, input.id))
        return input.id
      }

      const countResult = await db.select({ value: count() }).from(categories)
      const id = makeId('category')
      await db.insert(categories).values({
        id,
        name,
        color: input.color ?? null,
        position: countResult[0]?.value ?? 0,
        isArchived: false,
      })
      return id
    },

    async reorderCategories(categoryIds: string[]) {
      for (const [position, id] of categoryIds.entries()) {
        await db.update(categories).set({ position }).where(eq(categories.id, id))
      }
    },

    async archiveCategory(categoryId: string) {
      await db
        .update(categories)
        .set({
          isArchived: true,
        })
        .where(eq(categories.id, categoryId))
    },
  }
}
