import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { formatHumanDate, shiftIsoDate } from '~/lib/dates'
import type { BoardSnapshot, TaskDraft, TaskRecord } from '~/lib/task-board'
import { deleteTask, saveBoardOrder, saveTask } from '~/server/task-board'

function moveTaskAcrossColumns(
  board: BoardSnapshot,
  taskId: string,
  overId: string,
) {
  const sourceColumnIndex = board.columns.findIndex((column) =>
    column.tasks.some((task) => task.id === taskId),
  )
  if (sourceColumnIndex === -1) {
    return board
  }

  const sourceTaskIndex = board.columns[sourceColumnIndex].tasks.findIndex(
    (task) => task.id === taskId,
  )
  const task = board.columns[sourceColumnIndex].tasks[sourceTaskIndex]
  const targetColumnIndex = board.columns.findIndex(
    (column) =>
      column.status.id === overId || column.tasks.some((candidate) => candidate.id === overId),
  )

  if (!task || targetColumnIndex === -1) {
    return board
  }

  const targetColumn = board.columns[targetColumnIndex]
  const overTaskIndex = targetColumn.tasks.findIndex((candidate) => candidate.id === overId)
  const insertIndex = overTaskIndex === -1 ? targetColumn.tasks.length : overTaskIndex

  const nextColumns = board.columns.map((column) => ({
    ...column,
    tasks: [...column.tasks],
  }))

  if (sourceColumnIndex === targetColumnIndex) {
    nextColumns[targetColumnIndex].tasks = arrayMove(
      nextColumns[targetColumnIndex].tasks,
      sourceTaskIndex,
      insertIndex,
    )
  } else {
    nextColumns[sourceColumnIndex].tasks.splice(sourceTaskIndex, 1)
    nextColumns[targetColumnIndex].tasks.splice(insertIndex, 0, {
      ...task,
      statusId: targetColumn.status.id,
    })
  }

  return {
    ...board,
    columns: nextColumns,
  }
}

function inferDoneStatusId(board: BoardSnapshot) {
  return (
    board.allStatuses.find((status) => /done|complete/i.test(status.name) && !status.isArchived)
      ?.id ?? null
  )
}

function emptyDraft(board: BoardSnapshot, day: string): TaskDraft {
  return {
    title: '',
    description: '',
    day,
    statusId: board.allStatuses.find((status) => !status.isArchived)?.id ?? '',
    categoryIds: [],
  }
}

export function TaskBoardPage({ initialBoard }: { initialBoard: BoardSnapshot }) {
  const navigate = useNavigate()
  const router = useRouter()
  const [board, setBoard] = useState(initialBoard)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [draft, setDraft] = useState<TaskDraft>(() =>
    emptyDraft(initialBoard, initialBoard.day),
  )
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const datePickerRef = useRef<HTMLInputElement | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    setBoard(initialBoard)
    setDraft((current) =>
      current.id ? current : emptyDraft(initialBoard, initialBoard.day),
    )
  }, [initialBoard])

  const selectedTask = useMemo(
    () =>
      board.columns
        .flatMap((column) => column.tasks)
        .find((task) => task.id === selectedTaskId) ?? null,
    [board.columns, selectedTaskId],
  )

  useEffect(() => {
    if (!selectedTask) {
      return
    }

    setDraft({
      id: selectedTask.id,
      title: selectedTask.title,
      description: selectedTask.description ?? '',
      day: selectedTask.day,
      statusId: selectedTask.statusId,
      categoryIds: selectedTask.categories.map((category) => category.id),
    })
    setIsComposerOpen(true)
  }, [selectedTask])

  const doneStatusId = inferDoneStatusId(board)

  async function refresh() {
    await router.invalidate()
  }

  async function persistBoard(nextBoard: BoardSnapshot) {
    setBoard(nextBoard)
    await saveBoardOrder({
      data: {
        day: nextBoard.day,
        columns: nextBoard.columns.map((column) => ({
          statusId: column.status.id,
          taskIds: column.tasks.map((task) => task.id),
        })),
      },
    })

    startTransition(() => {
      void refresh()
    })
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTaskId(null)

    if (!event.over || !event.active.id) {
      return
    }

    const nextBoard = moveTaskAcrossColumns(
      board,
      String(event.active.id),
      String(event.over.id),
    )

    if (nextBoard === board) {
      return
    }

    await persistBoard(nextBoard)
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveTaskId(String(event.active.id))
  }

  async function handleSaveTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await saveTask({ data: draft })
    setDraft(emptyDraft(board, board.day))
    setSelectedTaskId(null)
    setIsComposerOpen(false)
    startTransition(() => {
      void refresh()
    })
  }

  async function handleDeleteTask(taskId: string) {
    await deleteTask({ data: { taskId } })
    setSelectedTaskId(null)
    setDraft(emptyDraft(board, board.day))
    setIsComposerOpen(false)
    startTransition(() => {
      void refresh()
    })
  }

  async function handleQuickComplete(task: TaskRecord) {
    if (!doneStatusId) {
      return
    }

    await saveTask({
      data: {
        id: task.id,
        title: task.title,
        description: task.description ?? '',
        day: task.day,
        statusId: doneStatusId,
        categoryIds: task.categories.map((category) => category.id),
      },
    })

    startTransition(() => {
      void refresh()
    })
  }

  const visibleColumns = board.columns.map((column) => ({
    ...column,
    tasks:
      categoryFilter == null
        ? column.tasks
        : column.tasks.filter((task) =>
            task.categories.some((category) => category.id === categoryFilter),
          ),
  }))

  function openComposerForNewTask() {
    setSelectedTaskId(null)
    setDraft(emptyDraft(board, board.day))
    setIsComposerOpen(true)
  }

  function closeComposer() {
    setSelectedTaskId(null)
    setDraft(emptyDraft(board, board.day))
    setIsComposerOpen(false)
  }

  return (
    <>
      <section className="board-page">
        <div className="board-hero">
          <div className="view-toggle" aria-label="Board view">
            <button type="button" className="view-tab active">
              Day
            </button>
            <button type="button" className="view-tab" disabled>
              Week
            </button>
          </div>
          <label className="date-title-picker">
            <span>{formatHumanDate(board.day)}</span>
            <input
              ref={datePickerRef}
              aria-label="Selected day"
              type="date"
              value={board.day}
              onChange={(event) =>
                navigate({
                  to: '/day/$date',
                  params: { date: event.target.value },
                })
              }
            />
          </label>
          <div className="hero-actions">
            <button
              type="button"
              className="nav-arrow"
              aria-label="Previous day"
              onClick={() =>
                navigate({
                  to: '/day/$date',
                  params: { date: shiftIsoDate(board.day, -1) },
                })
              }
            >
              <svg viewBox="0 0 20 20" focusable="false">
                <path
                  d="M11.5 4.5 6 10l5.5 5.5"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.7"
                />
              </svg>
            </button>
            <button
              type="button"
              className="nav-arrow"
              aria-label="Open day picker"
              onClick={() => datePickerRef.current?.showPicker?.()}
            >
              <svg viewBox="0 0 20 20" focusable="false">
                <path
                  d="M5.5 3.5v2m9-2v2M4 7.5h12m-10.5 3h2m2.5 0h2m-6.5 3h2m2.5 0h2M5 5.5h10a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.3"
                />
              </svg>
            </button>
            <button
              type="button"
              className="nav-arrow"
              aria-label="Next day"
              onClick={() =>
                navigate({
                  to: '/day/$date',
                  params: { date: shiftIsoDate(board.day, 1) },
                })
              }
            >
              <svg viewBox="0 0 20 20" focusable="false">
                <path
                  d="m8.5 4.5 5.5 5.5-5.5 5.5"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.7"
                />
              </svg>
            </button>
            <button
              type="button"
              className="primary compact"
              onClick={openComposerForNewTask}
            >
              Add task
            </button>
            <Link to="/settings" className="minimal-link">
              Settings
            </Link>
          </div>
        </div>

        <div className="board-toolbar">
          <div className="filter-row">
            <button
              type="button"
              className={categoryFilter == null ? 'filter-pill active' : 'filter-pill'}
              onClick={() => setCategoryFilter(null)}
            >
              All
            </button>
            {board.allCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                className={categoryFilter === category.id ? 'filter-pill active' : 'filter-pill'}
                onClick={() =>
                  setCategoryFilter((current) =>
                    current === category.id ? null : category.id,
                  )
                }
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={(event) => {
            void handleDragEnd(event)
          }}
        >
          <div className="board-columns minimal">
            {visibleColumns.map((column) => (
              <StatusColumn
                key={column.status.id}
                column={column}
                onSelectTask={(task) => {
                  setSelectedTaskId(task.id)
                }}
                onQuickComplete={(task) => void handleQuickComplete(task)}
                doneStatusId={doneStatusId}
                activeTaskId={activeTaskId}
              />
            ))}
          </div>
        </DndContext>
      </section>

      <div
        className={isComposerOpen ? 'drawer-backdrop visible' : 'drawer-backdrop'}
        onClick={closeComposer}
      />
      <aside className={isComposerOpen ? 'task-drawer open' : 'task-drawer'}>
        <div className="drawer-header">
          <div>
            <p className="eyebrow">{draft.id ? 'Edit Task' : 'Add Task'}</p>
            <h3>{draft.id ? 'Update task details' : 'Create a task for the day'}</h3>
          </div>
          <button type="button" className="nav-arrow" onClick={closeComposer} aria-label="Close editor">
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

        <form className="task-form minimal" onSubmit={(event) => void handleSaveTask(event)}>
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
                {board.allStatuses
                  .filter(
                    (status) =>
                      !status.isArchived || status.id === draft.statusId,
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
            <div className="category-picker">
              {board.allCategories.map((category) => {
                const isChecked = draft.categoryIds.includes(category.id)
                return (
                  <label key={category.id} className="checkbox-pill">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() =>
                        setDraft((current) => ({
                          ...current,
                          categoryIds: isChecked
                            ? current.categoryIds.filter((id) => id !== category.id)
                            : [...current.categoryIds, category.id],
                        }))
                      }
                    />
                    <span
                      className={
                        isChecked
                          ? 'checkbox-pill-label selected'
                          : 'checkbox-pill-label'
                      }
                    >
                      {category.name}
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>
          <div className="form-actions">
            <button type="submit" className="primary">
              {draft.id ? 'Save task' : 'Add task'}
            </button>
            <button type="button" className="secondary" onClick={closeComposer}>
              Cancel
            </button>
            {draft.id ? (
              <button
                type="button"
                className="danger"
                onClick={() => void handleDeleteTask(draft.id!)}
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

function StatusColumn({
  column,
  onSelectTask,
  onQuickComplete,
  doneStatusId,
  activeTaskId,
}: {
  column: BoardSnapshot['columns'][number]
  onSelectTask: (task: TaskRecord) => void
  onQuickComplete: (task: TaskRecord) => void
  doneStatusId: string | null
  activeTaskId: string | null
}) {
  const { setNodeRef } = useDroppable({
    id: column.status.id,
  })

  return (
    <section
      ref={setNodeRef}
      className={column.status.isArchived ? 'status-column archived' : 'status-column'}
    >
      <header>
        <h3>{column.status.name}</h3>
        <p>{column.tasks.length}</p>
      </header>
      <SortableContext
        items={column.tasks.map((task) => task.id)}
        strategy={rectSortingStrategy}
      >
        <div className="task-stack">
          {column.tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onSelect={() => onSelectTask(task)}
              onQuickComplete={() => onQuickComplete(task)}
              quickCompleteEnabled={doneStatusId != null && task.statusId !== doneStatusId}
              isDraggingTask={activeTaskId === task.id}
            />
          ))}
          {column.tasks.length === 0 ? (
            <div className="empty-column">Drop a task here</div>
          ) : null}
        </div>
      </SortableContext>
    </section>
  )
}

function TaskCard({
  task,
  onSelect,
  onQuickComplete,
  quickCompleteEnabled,
  isDraggingTask,
}: {
  task: TaskRecord
  onSelect: () => void
  onQuickComplete: () => void
  quickCompleteEnabled: boolean
  isDraggingTask: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: task.id,
    })

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={isDragging ? 'task-card dragging' : 'task-card'}
      {...attributes}
      {...listeners}
    >
      <button className="task-main" type="button" onClick={onSelect}>
        <div className="task-heading">
          <h4>{task.title}</h4>
          <div className="task-trailing">
            {quickCompleteEnabled ? (
              <button
                type="button"
                className="icon-button subdued"
                aria-label={`Mark ${task.title} done`}
                title="Mark done"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation()
                  onQuickComplete()
                }}
              >
                <svg viewBox="0 0 20 20" focusable="false">
                  <path
                    d="M16.5 5.5 8.75 13.25 4.5 9"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              </button>
            ) : null}
            <span
              className={isDraggingTask ? 'drag-indicator active' : 'drag-indicator'}
              aria-hidden="true"
            >
              <svg viewBox="0 0 20 20" focusable="false">
                <path
                  d="M7 4.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm0 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm0 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm9-11a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm0 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm0 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
                  fill="currentColor"
                />
              </svg>
            </span>
          </div>
        </div>
        {task.description ? <p>{task.description}</p> : null}
        {task.categories.length > 0 ? (
          <div className="task-pill-row">
            {task.categories.map((category) => (
              <span key={category.id} className="category-badge">
                {category.name}
              </span>
            ))}
          </div>
        ) : null}
      </button>
    </article>
  )
}
