import { primaryKey, sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const statuses = sqliteTable('statuses', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull(),
  position: integer('position').notNull(),
  isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
})

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color'),
  position: integer('position').notNull(),
  isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
})

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  day: text('day').notNull(),
  statusId: text('status_id')
    .notNull()
    .references(() => statuses.id),
  position: integer('position').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const taskCategories = sqliteTable(
  'task_categories',
  {
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    categoryId: text('category_id')
      .notNull()
      .references(() => categories.id),
  },
  (table) => [primaryKey({ columns: [table.taskId, table.categoryId] })],
)

export const schema = {
  statuses,
  categories,
  tasks,
  taskCategories,
}
