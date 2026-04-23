import { useEffect } from 'react'
import type { CategoryRecord, StatusRecord, TaskDraft } from '~/lib/task-board'

function categoryAccentStyle(color: string | null): React.CSSProperties {
  return {
    '--category-color': color ?? '#7f7f7a',
  } as React.CSSProperties
}

export function TaskEditorDrawer({
  open,
  draft,
  setDraft,
  statuses,
  categories,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean
  draft: TaskDraft
  setDraft: (updater: (current: TaskDraft) => TaskDraft) => void
  statuses: StatusRecord[]
  categories: CategoryRecord[]
  onClose: () => void
  onSave: (event: React.FormEvent<HTMLFormElement>) => void | Promise<void>
  onDelete: (taskId: string) => void | Promise<void>
}) {
  useEffect(() => {
    if (!open) {
      return
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKey)
    }
  }, [open, onClose])

  function toggleCategory(id: string) {
    setDraft((current) => ({
      ...current,
      categoryIds: current.categoryIds.includes(id)
        ? current.categoryIds.filter((entry) => entry !== id)
        : [...current.categoryIds, id],
    }))
  }

  return (
    <>
      <div
        className={open ? 'drawer-backdrop visible' : 'drawer-backdrop'}
        onClick={onClose}
      />
      <aside className={open ? 'task-drawer open' : 'task-drawer'}>
        <div className="drawer-header">
          <div>
            <p className="eyebrow">{draft.id ? 'Edit Task' : 'Add Task'}</p>
            <h3>{draft.id ? 'Update task details' : 'Create a task for the day'}</h3>
          </div>
          <button
            type="button"
            className="icon-button drawer-close"
            onClick={onClose}
            aria-label="Close editor"
          >
            <svg viewBox="0 0 20 20" focusable="false">
              <path
                d="m5 5 10 10M15 5 5 15"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.6"
              />
            </svg>
          </button>
        </div>

        <form className="task-form minimal" onSubmit={(event) => void onSave(event)}>
          <label>
            Title
            <input
              required
              placeholder="What needs doing?"
              value={draft.title}
              onChange={(event) =>
                setDraft((current) => ({ ...current, title: event.target.value }))
              }
            />
          </label>
          <label>
            Notes
            <textarea
              rows={5}
              placeholder="Optional details"
              value={draft.description}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </label>
          <div className="two-up">
            <label>
              Day
              <input
                type="date"
                value={draft.day}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, day: event.target.value }))
                }
              />
            </label>
            <label>
              Status
              <select
                value={draft.statusId}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    statusId: event.target.value,
                  }))
                }
              >
                {statuses
                  .filter(
                    (status) => !status.isArchived || status.id === draft.statusId,
                  )
                  .map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.name}
                      {status.isArchived ? ' (archived)' : ''}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <fieldset>
            <legend>Categories</legend>
            <div className="filter-row">
              {categories.map((category) => {
                const isChecked = draft.categoryIds.includes(category.id)
                return (
                  <button
                    key={category.id}
                    type="button"
                    className={isChecked ? 'filter-pill active' : 'filter-pill'}
                    style={categoryAccentStyle(category.color)}
                    onClick={() => toggleCategory(category.id)}
                    aria-pressed={isChecked}
                  >
                    {category.name}
                  </button>
                )
              })}
            </div>
          </fieldset>
          <div className="form-actions">
            <button type="submit" className="primary">
              {draft.id ? 'Save task' : 'Add task'}
            </button>
            <button type="button" className="secondary" onClick={onClose}>
              Cancel
            </button>
            {draft.id ? (
              <button
                type="button"
                className="danger"
                onClick={() => void onDelete(draft.id!)}
              >
                Delete
              </button>
            ) : null}
          </div>
        </form>
      </aside>
    </>
  )
}
