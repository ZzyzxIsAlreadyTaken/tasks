export type CategoryRecord = {
  id: string
  name: string
  color: string | null
  position: number
  isArchived: boolean
}

export type StatusRecord = {
  id: string
  name: string
  color: string
  position: number
  isArchived: boolean
}

export type TaskRecord = {
  id: string
  title: string
  description: string | null
  day: string
  statusId: string
  position: number
  categories: CategoryRecord[]
}

export type BoardColumn = {
  status: StatusRecord
  tasks: TaskRecord[]
}

export type BoardSnapshot = {
  day: string
  columns: BoardColumn[]
  allStatuses: StatusRecord[]
  allCategories: CategoryRecord[]
}

export type SettingsSnapshot = {
  statuses: Array<StatusRecord & { taskCount: number }>
  categories: Array<CategoryRecord & { taskCount: number }>
}

export type TaskDraft = {
  id?: string
  title: string
  description: string
  day: string
  statusId: string
  categoryIds: string[]
}

export type SaveBoardOrderInput = {
  day: string
  columns: Array<{
    statusId: string
    taskIds: string[]
  }>
}

export type UpsertStatusInput = {
  id?: string
  name: string
  color: string
}

export type UpsertCategoryInput = {
  id?: string
  name: string
  color?: string | null
}
