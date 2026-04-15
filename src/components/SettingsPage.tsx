import { startTransition, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import type { SettingsSnapshot } from '~/lib/task-board'
import {
  archiveCategory,
  archiveStatus,
  reorderCategories,
  reorderStatuses,
  saveCategory,
  saveStatus,
} from '~/server/task-board'

export function SettingsPage({ initialSettings }: { initialSettings: SettingsSnapshot }) {
  const router = useRouter()
  const [statusDraft, setStatusDraft] = useState({ name: '', color: '#2563eb' })
  const [categoryDraft, setCategoryDraft] = useState({ name: '', color: '#0f766e' })

  async function refresh() {
    await router.invalidate()
  }

  async function moveStatus(id: string, direction: -1 | 1) {
    const ids = [...initialSettings.statuses].sort((a, b) => a.position - b.position).map((status) => status.id)
    const index = ids.indexOf(id)
    const nextIndex = index + direction
    if (index === -1 || nextIndex < 0 || nextIndex >= ids.length) {
      return
    }

    const [moved] = ids.splice(index, 1)
    ids.splice(nextIndex, 0, moved)
    await reorderStatuses({ data: { ids } })
    startTransition(() => {
      void refresh()
    })
  }

  async function moveCategory(id: string, direction: -1 | 1) {
    const ids = [...initialSettings.categories]
      .sort((a, b) => a.position - b.position)
      .map((category) => category.id)
    const index = ids.indexOf(id)
    const nextIndex = index + direction
    if (index === -1 || nextIndex < 0 || nextIndex >= ids.length) {
      return
    }

    const [moved] = ids.splice(index, 1)
    ids.splice(nextIndex, 0, moved)
    await reorderCategories({ data: { ids } })
    startTransition(() => {
      void refresh()
    })
  }

  return (
    <section className="settings-page">
      <div className="settings-header">
        <div>
          <p className="eyebrow">Settings</p>
          <h2>Shape the board to match your workflow.</h2>
          <p className="subtle">
            Rename, reorder, and archive statuses or categories without losing
            task history.
          </p>
        </div>
      </div>

      <div className="settings-grid">
        <section className="settings-card">
          <h3>Statuses</h3>
          <form
            className="inline-form"
            onSubmit={(event) => {
              event.preventDefault()
              void saveStatus({ data: statusDraft }).then(() => {
                setStatusDraft({ name: '', color: '#2563eb' })
                startTransition(() => {
                  void refresh()
                })
              })
            }}
          >
            <input
              placeholder="New status"
              value={statusDraft.name}
              onChange={(event) =>
                setStatusDraft((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
            <input
              type="color"
              aria-label="Status color"
              value={statusDraft.color}
              onChange={(event) =>
                setStatusDraft((current) => ({
                  ...current,
                  color: event.target.value,
                }))
              }
            />
            <button type="submit">Add status</button>
          </form>
          <div className="settings-list">
            {initialSettings.statuses.map((status, index) => (
              <div key={status.id} className="settings-row">
                <div className="settings-title">
                  <span className="color-dot" style={{ backgroundColor: status.color }} />
                  <div>
                    <strong>{status.name}</strong>
                    <p>
                      {status.taskCount} tasks
                      {status.isArchived ? ' • archived' : ''}
                    </p>
                  </div>
                </div>
                <div className="settings-actions">
                  <button
                    type="button"
                    onClick={() => void moveStatus(status.id, -1)}
                    disabled={index === 0}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    onClick={() => void moveStatus(status.id, 1)}
                    disabled={index === initialSettings.statuses.length - 1}
                  >
                    Down
                  </button>
                  {!status.isArchived ? (
                    <button
                      type="button"
                      onClick={() => void archiveStatus({ data: { id: status.id } }).then(refresh)}
                    >
                      Archive
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="settings-card">
          <h3>Categories</h3>
          <form
            className="inline-form"
            onSubmit={(event) => {
              event.preventDefault()
              void saveCategory({ data: categoryDraft }).then(() => {
                setCategoryDraft({ name: '', color: '#0f766e' })
                startTransition(() => {
                  void refresh()
                })
              })
            }}
          >
            <input
              placeholder="New category"
              value={categoryDraft.name}
              onChange={(event) =>
                setCategoryDraft((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
            <input
              type="color"
              aria-label="Category color"
              value={categoryDraft.color}
              onChange={(event) =>
                setCategoryDraft((current) => ({
                  ...current,
                  color: event.target.value,
                }))
              }
            />
            <button type="submit">Add category</button>
          </form>
          <div className="settings-list">
            {initialSettings.categories.map((category, index) => (
              <div key={category.id} className="settings-row">
                <div className="settings-title">
                  <span
                    className="color-dot"
                    style={{ backgroundColor: category.color ?? '#94a3b8' }}
                  />
                  <div>
                    <strong>{category.name}</strong>
                    <p>
                      {category.taskCount} tasks
                      {category.isArchived ? ' • archived' : ''}
                    </p>
                  </div>
                </div>
                <div className="settings-actions">
                  <button
                    type="button"
                    onClick={() => void moveCategory(category.id, -1)}
                    disabled={index === 0}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    onClick={() => void moveCategory(category.id, 1)}
                    disabled={index === initialSettings.categories.length - 1}
                  >
                    Down
                  </button>
                  {!category.isArchived ? (
                    <button
                      type="button"
                      onClick={() =>
                        void archiveCategory({ data: { id: category.id } }).then(refresh)
                      }
                    >
                      Archive
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  )
}
