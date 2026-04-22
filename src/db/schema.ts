import { boolean, integer, pgTable, primaryKey, text } from 'drizzle-orm/pg-core'

export const statuses = pgTable('statuses', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull(),
  position: integer('position').notNull(),
  isArchived: boolean('is_archived').notNull().default(false),
})

export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color'),
  position: integer('position').notNull(),
  isArchived: boolean('is_archived').notNull().default(false),
})

export const tasks = pgTable('tasks', {
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

export const taskCategories = pgTable(
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
