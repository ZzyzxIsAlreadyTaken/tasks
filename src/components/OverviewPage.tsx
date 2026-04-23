import { startTransition, useMemo, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import type { OverviewSnapshot, OverviewTaskRecord, TaskDraft } from '~/lib/task-board'
import { deleteTask, saveTask } from '~/server/task-board'
import { TaskEditorDrawer } from './TaskEditorDrawer'

function categoryAccentStyle(color: string | null): React.CSSProperties {
  return {
    '--category-color': color ?? '#7f7f7a',
  } as React.CSSProperties
}

function draftFromTask(task: OverviewTaskRecord): TaskDraft {
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? '',
    day: task.day,
    statusId: task.statusId,
    categoryIds: task.categories.map((category) => category.id),
  }
}

function emptyDraft(statusId: string): TaskDraft {
  const today = new Date().toISOString().slice(0, 10)
  return {
    title: '',
    description: '',
    day: today,
    statusId,
    categoryIds: [],
  }
}

export function OverviewPage({ overview }: { overview: OverviewSnapshot }) {
  const router = useRouter()
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const defaultStatusId =
    overview.statuses.find((status) => !status.isArchived)?.id ??
    overview.statuses[0]?.id ??
    ''
  const [draft, setDraft] = useState<TaskDraft>(() => emptyDraft(defaultStatusId))
  const [isComposerOpen, setIsComposerOpen] = useState(false)

  const normalizedQuery = query.trim().toLowerCase()

  const grouped = useMemo(() => {
    const visibleTasks = overview.tasks.filter((task) => {
      if (categoryFilter && !task.categories.some((category) => category.id === categoryFilter)) {
        return false
      }

      if (!normalizedQuery) {
        return true
      }

      return (
        task.title.toLowerCase().includes(normalizedQuery) ||
        (task.description?.toLowerCase().includes(normalizedQuery) ?? false)
      )
    })

    const byStatus = new Map<string, typeof visibleTasks>()
    for (const status of overview.statuses) {
      byStatus.set(status.id, [])
    }
    for (const task of visibleTasks) {
      byStatus.set(task.statusId, [...(byStatus.get(task.statusId) ?? []), task])
    }

    return overview.statuses.map((status) => ({
      status,
      tasks: byStatus.get(status.id) ?? [],
    }))
  }, [categoryFilter, normalizedQuery, overview])

  const visibleTaskCount = grouped.reduce((sum, group) => sum + group.tasks.length, 0)

  function openTaskEditor(task: OverviewTaskRecord) {
    setDraft(draftFromTask(task))
    setIsComposerOpen(true)
  }

  function closeEditor() {
    setIsComposerOpen(false)
    setDraft(emptyDraft(defaultStatusId))
  }

  async function refresh() {
    await router.invalidate()
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await saveTask({ data: draft })
    closeEditor()
    startTransition(() => {
      void refresh()
    })
  }

  async function handleDelete(taskId: string) {
    await deleteTask({ data: { taskId } })
    closeEditor()
    startTransition(() => {
      void refresh()
    })
  }

  return (
    <>
      <section className="overview-page">
        <div className="settings-header">
          <div>
            <p className="eyebrow">Overview</p>
            <h2>All tasks grouped by status.</h2>
            <p className="subtle">Quickly scan everything across days, statuses, and categories.</p>
          </div>
        </div>

        <div className="overview-toolbar">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tasks"
            aria-label="Search tasks"
          />
          <span className="subtle">{visibleTaskCount} tasks shown</span>
        </div>

        <div className="filter-row">
          <button
            type="button"
            className={categoryFilter == null ? 'filter-pill active' : 'filter-pill'}
            onClick={() => setCategoryFilter(null)}
          >
            All categories
          </button>
          {overview.categories.map((category) => (
            <button
              key={category.id}
              type="button"
              className={categoryFilter === category.id ? 'filter-pill active' : 'filter-pill'}
              style={categoryAccentStyle(category.color)}
              onClick={() =>
                setCategoryFilter((current) => (current === category.id ? null : category.id))
              }
            >
              {category.name}
            </button>
          ))}
        </div>

        <div className="overview-groups">
          {grouped.map((group) => (
            <section key={group.status.id} className="overview-group">
              <header>
                <h3>{group.status.name}</h3>
                <p>{group.tasks.length}</p>
              </header>
              {group.tasks.length > 0 ? (
                <div className="overview-task-list">
                  {group.tasks.map((task) => (
                    <article
                      key={task.id}
                      className="overview-task-row clickable"
                      role="button"
                      tabIndex={0}
                      onClick={() => openTaskEditor(task)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          openTaskEditor(task)
                        }
                      }}
                    >
                      <div>
                        <strong>{task.title}</strong>
                        {task.description ? <p>{task.description}</p> : null}
                      </div>
                      <div className="overview-task-meta">
                        <span>{task.day}</span>
                        <div className="task-pill-row">
                          {task.categories.map((category) => (
                            <span
                              key={category.id}
                              className="category-badge"
                              style={categoryAccentStyle(category.color)}
                            >
                              {category.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-column">No tasks in this status</div>
              )}
            </section>
          ))}
        </div>
      </section>

      <TaskEditorDrawer
        open={isComposerOpen}
        draft={draft}
        setDraft={setDraft}
        statuses={overview.statuses}
        categories={overview.categories}
        onClose={closeEditor}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </>
  )
}
