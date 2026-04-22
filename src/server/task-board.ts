import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import { getTaskBoardStore } from '~/db/client'
import { getWeekIsoDates } from '~/lib/dates'

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const taskDraftSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  description: z.string(),
  day: isoDateSchema,
  statusId: z.string(),
  categoryIds: z.array(z.string()),
})

const boardOrderSchema = z.object({
  day: isoDateSchema,
  columns: z.array(
    z.object({
      statusId: z.string(),
      taskIds: z.array(z.string()),
    }),
  ),
})

const statusSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  color: z.string(),
})

const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  color: z.string().nullable().optional(),
})

export const loadBoard = createServerFn({ method: 'GET' })
  .inputValidator((input: { day: string }) => ({ day: isoDateSchema.parse(input.day) }))
  .handler(async ({ data }) => {
    const store = await getTaskBoardStore()
    await store.seedDefaults()
    const board = await store.getBoard(data.day)
    const weekDates = getWeekIsoDates(data.day)
    const weekDays = await Promise.all(weekDates.map((day) => store.getBoard(day)))

    return {
      board,
      week: {
        anchorDay: data.day,
        days: weekDays,
      },
    }
  })

export const saveTask = createServerFn({ method: 'POST' })
  .inputValidator((input) => taskDraftSchema.parse(input))
  .handler(async ({ data }) => {
    const store = await getTaskBoardStore()
    await store.seedDefaults()
    return store.saveTask(data)
  })

export const deleteTask = createServerFn({ method: 'POST' })
  .inputValidator((input: { taskId: string }) => ({ taskId: z.string().parse(input.taskId) }))
  .handler(async ({ data }) => {
    const store = await getTaskBoardStore()
    await store.deleteTask(data.taskId)
    return { ok: true }
  })

export const saveBoardOrder = createServerFn({ method: 'POST' })
  .inputValidator((input) => boardOrderSchema.parse(input))
  .handler(async ({ data }) => {
    const store = await getTaskBoardStore()
    await store.saveBoardOrder(data)
    return { ok: true }
  })

export const loadSettings = createServerFn({ method: 'GET' }).handler(async () => {
  const store = await getTaskBoardStore()
  await store.seedDefaults()
  return store.getSettings()
})

export const saveStatus = createServerFn({ method: 'POST' })
  .inputValidator((input) => statusSchema.parse(input))
  .handler(async ({ data }) => {
    const store = await getTaskBoardStore()
    return store.upsertStatus(data)
  })

export const reorderStatuses = createServerFn({ method: 'POST' })
  .inputValidator((input: { ids: string[] }) => ({ ids: z.array(z.string()).parse(input.ids) }))
  .handler(async ({ data }) => {
    const store = await getTaskBoardStore()
    await store.reorderStatuses(data.ids)
    return { ok: true }
  })

export const archiveStatus = createServerFn({ method: 'POST' })
  .inputValidator((input: { id: string }) => ({ id: z.string().parse(input.id) }))
  .handler(async ({ data }) => {
    const store = await getTaskBoardStore()
    await store.archiveStatus(data.id)
    return { ok: true }
  })

export const saveCategory = createServerFn({ method: 'POST' })
  .inputValidator((input) => categorySchema.parse(input))
  .handler(async ({ data }) => {
    const store = await getTaskBoardStore()
    return store.upsertCategory(data)
  })

export const reorderCategories = createServerFn({ method: 'POST' })
  .inputValidator((input: { ids: string[] }) => ({ ids: z.array(z.string()).parse(input.ids) }))
  .handler(async ({ data }) => {
    const store = await getTaskBoardStore()
    await store.reorderCategories(data.ids)
    return { ok: true }
  })

export const archiveCategory = createServerFn({ method: 'POST' })
  .inputValidator((input: { id: string }) => ({ id: z.string().parse(input.id) }))
  .handler(async ({ data }) => {
    const store = await getTaskBoardStore()
    await store.archiveCategory(data.id)
    return { ok: true }
  })
