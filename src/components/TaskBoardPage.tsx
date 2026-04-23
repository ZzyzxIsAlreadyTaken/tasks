import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
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
import { useNavigate, useRouter } from '@tanstack/react-router'
import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import {
  formatHumanDate,
  formatWeekRange,
  getIsoDayOfMonth,
  getIsoWeekNumber,
  getIsoWeekdayShort,
  isIsoToday,
  isIsoWeekend,
  shiftIsoDate,
} from '~/lib/dates'
import type {
  BoardColumn,
  BoardRouteData,
  BoardSnapshot,
  CategoryRecord,
  TaskDraft,
  TaskRecord,
} from '~/lib/task-board'
import { deleteTask, saveBoardOrder, saveTask } from '~/server/task-board'
import { TaskEditorDrawer } from './TaskEditorDrawer'

type BoardView = 'day' | 'week'

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
      column.status.id === overId ||
      column.tasks.some((candidate) => candidate.id === overId),
  )

  if (!task || targetColumnIndex === -1) {
    return board
  }

  const targetColumn = board.columns[targetColumnIndex]
  const overTaskIndex = targetColumn.tasks.findIndex(
    (candidate) => candidate.id === overId,
  )
  const insertIndex =
    overTaskIndex === -1 ? targetColumn.tasks.length : overTaskIndex

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

function categoryAccentStyle(color: string | null): React.CSSProperties {
  return {
    '--category-color': color ?? '#7f7f7a',
  } as React.CSSProperties
}

function taskStatusAccentStyle(color: string): React.CSSProperties {
  return {
    '--task-status-color': color,
  } as React.CSSProperties
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

function WeekDayCard({
  day,
  isSelected,
  doneStatusId,
  onSelectDay,
  onOpenDay,
  onSelectTask,
  onQuickAdd,
}: {
  day: BoardSnapshot
  isSelected: boolean
  doneStatusId: string | null
  onSelectDay: () => void
  onOpenDay: () => void
  onSelectTask: (task: TaskRecord) => void
  onQuickAdd: () => void
}) {
  const today = isIsoToday(day.day)
  const weekend = isIsoWeekend(day.day)
  const totalTasks = day.columns.reduce((sum, col) => sum + col.tasks.length, 0)

  const classes = [
    'week-day-card',
    isSelected ? 'is-selected' : '',
    today ? 'is-today' : '',
    weekend ? 'is-weekend' : '',
  ]
    .filter(Boolean)
    .join(' ')

  function handleCardClick(event: React.MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('button, details, summary, a')) {
      return
    }
    onSelectDay()
  }

  function handleCardKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) {
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelectDay()
    }
  }

  return (
    <div
      className={classes}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={`Select ${day.day}`}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
    >
      <div className="week-day-header">
        <div className="week-day-date-block">
          <span className="week-day-weekday">{getIsoWeekdayShort(day.day)}</span>
          <span className="week-day-date">{getIsoDayOfMonth(day.day)}</span>
        </div>
        <div className="week-day-meta">
          {today ? <span className="week-today-pill">Today</span> : null}
          <span className="week-day-count" aria-label={`${totalTasks} tasks`}>
            {totalTasks}
          </span>
          <button
            type="button"
            className="week-quick-add"
            aria-label={`Add task on ${day.day}`}
            onClick={onQuickAdd}
          >
            <svg viewBox="0 0 20 20" width="20" height="20" focusable="false" aria-hidden="true">
              <path
                d="M10 4v12M4 10h12"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2"
              />
            </svg>
          </button>
        </div>
      </div>

      {totalTasks === 0 ? (
        <div className="week-empty">No tasks</div>
      ) : (
        <div className="week-day-list">
          {day.columns.map((column) =>
            column.tasks.length > 0 ? (
              <WeekStatusGroup
                key={column.status.id}
                column={column}
                collapsible={column.status.id === doneStatusId}
                onSelectTask={onSelectTask}
              />
            ) : null,
          )}
        </div>
      )}

      <button
        type="button"
        className="week-open-day-link"
        onClick={onOpenDay}
        aria-label={`Open ${day.day} in day view`}
      >
        Open <span aria-hidden="true">→</span>
      </button>
    </div>
  )
}

function WeekStatusGroup({
  column,
  collapsible,
  onSelectTask,
}: {
  column: BoardColumn
  collapsible: boolean
  onSelectTask: (task: TaskRecord) => void
}) {
  const body = (
    <div className="week-status-items">
      {column.tasks.map((task) => (
        <WeekTaskRow
          key={task.id}
          task={task}
          statusColor={column.status.color}
          onSelect={() => onSelectTask(task)}
        />
      ))}
    </div>
  )

  if (collapsible) {
    return (
      <details className="week-status-group">
        <summary>
          <span className="week-status-header">
            <span
              className="week-status-chevron"
              aria-hidden="true"
            >
              <svg viewBox="0 0 20 20" width="20" height="20" focusable="false">
                <path
                  d="m7.5 5 5 5-5 5"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </span>
            <span
              className="week-status-dot"
              style={{ '--task-status-color': column.status.color } as React.CSSProperties}
            />
            <span className="week-status-name">{column.status.name}</span>
            <span className="week-status-count">{column.tasks.length}</span>
          </span>
        </summary>
        {body}
      </details>
    )
  }

  return (
    <div className="week-status-group">
      <div className="week-status-header">
        <span
          className="week-status-dot"
          style={{ '--task-status-color': column.status.color } as React.CSSProperties}
        />
        <span className="week-status-name">{column.status.name}</span>
        <span className="week-status-count">{column.tasks.length}</span>
      </div>
      {body}
    </div>
  )
}

function WeekTaskRow({
  task,
  statusColor,
  onSelect,
}: {
  task: TaskRecord
  statusColor: string
  onSelect: () => void
}) {
  const visibleCategories = task.categories.slice(0, 2)
  const overflowCount = task.categories.length - visibleCategories.length

  return (
    <button
      type="button"
      className="week-task-row"
      style={{ '--task-status-color': statusColor } as React.CSSProperties}
      onClick={onSelect}
    >
      <span className="week-task-title">{task.title}</span>
      {task.categories.length > 0 ? (
        <span className="week-task-chips">
          {visibleCategories.map((category: CategoryRecord) => (
            <span
              key={category.id}
              className="week-category-chip"
              style={categoryAccentStyle(category.color)}
              title={category.name}
            >
              {category.name}
            </span>
          ))}
          {overflowCount > 0 ? (
            <span className="week-category-chip more" title={`${overflowCount} more`}>
              +{overflowCount}
            </span>
          ) : null}
        </span>
      ) : null}
    </button>
  )
}

export function TaskBoardPage({
  initialData,
  initialEditTaskId = null,
}: {
  initialData: BoardRouteData
  initialEditTaskId?: string | null
}) {
  const navigate = useNavigate()
  const router = useRouter()
  const [data, setData] = useState(initialData)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    initialEditTaskId,
  )
  const [draft, setDraft] = useState<TaskDraft>(() =>
    emptyDraft(initialData.board, initialData.board.day),
  )
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const [view, setView] = useState<BoardView>('day')
  const [isScrolled, setIsScrolled] = useState(false)
  const datePickerRef = useRef<HTMLInputElement | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    setData(initialData)
    setDraft((current) =>
      current.id ? current : emptyDraft(initialData.board, initialData.board.day),
    )
  }, [initialData])

  useEffect(() => {
    if (initialEditTaskId) {
      setSelectedTaskId(initialEditTaskId)
    }
  }, [initialEditTaskId])

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 6)
    }
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const board = data.board
  const week = data.week

  const selectedTask = useMemo(() => {
    if (!selectedTaskId) {
      return null
    }

    const inBoard = board.columns
      .flatMap((column) => column.tasks)
      .find((task) => task.id === selectedTaskId)
    if (inBoard) {
      return inBoard
    }

    for (const weekDay of week.days) {
      const match = weekDay.columns
        .flatMap((column) => column.tasks)
        .find((task) => task.id === selectedTaskId)
      if (match) {
        return match
      }
    }

    return null
  }, [board.columns, week.days, selectedTaskId])

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

  const activeTask = useMemo(
    () =>
      board.columns
        .flatMap((column) => column.tasks)
        .find((task) => task.id === activeTaskId) ?? null,
    [activeTaskId, board.columns],
  )

  const collisionDetection: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args)
    if (pointerCollisions.length > 0) {
      return pointerCollisions
    }

    return closestCenter(args)
  }

  async function refresh() {
    await router.invalidate()
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

    setData((current) => ({ ...current, board: nextBoard }))

    try {
      await saveBoardOrder({
        data: {
          day: nextBoard.day,
          columns: nextBoard.columns.map((column) => ({
            statusId: column.status.id,
            taskIds: column.tasks.map((task) => task.id),
          })),
        },
      })
    } catch (error) {
      setData(initialData)
      throw error
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveTaskId(String(event.active.id))
  }

  async function handleSaveTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await saveTask({ data: draft })
    closeComposer()
    startTransition(() => {
      void refresh()
    })
  }

  async function handleDeleteTask(taskId: string) {
    await deleteTask({ data: { taskId } })
    closeComposer()
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

  function openComposerForNewTask(options?: { day?: string }) {
    setSelectedTaskId(null)
    setDraft(emptyDraft(board, options?.day ?? board.day))
    setIsComposerOpen(true)
  }

  function closeComposer() {
    setSelectedTaskId(null)
    setDraft(emptyDraft(board, board.day))
    setIsComposerOpen(false)
  }

  function openDatePicker() {
    const input = datePickerRef.current as
      | (HTMLInputElement & { showPicker?: () => void })
      | null

    if (!input) {
      return
    }

    if (typeof input.showPicker === 'function') {
      input.showPicker()
      return
    }

    input.focus()
    input.click()
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

  const heroLabel =
    view === 'week' ? formatWeekRange(board.day) : formatHumanDate(board.day)
  const weekNumber = view === 'week' ? getIsoWeekNumber(board.day) : null
  const navStep = view === 'week' ? 7 : 1
  const previousLabel = view === 'week' ? 'Previous week' : 'Previous day'
  const nextLabel = view === 'week' ? 'Next week' : 'Next day'

  return (
    <>
      <section className="board-page">
        <div className={isScrolled ? 'board-sticky is-scrolled' : 'board-sticky'}>
          <div className="board-hero">
            <div className="view-toggle" aria-label="Board view">
              <button
                type="button"
                className={view === 'day' ? 'view-tab active' : 'view-tab'}
                onClick={() => setView('day')}
              >
                Day
              </button>
              <button
                type="button"
                className={view === 'week' ? 'view-tab active' : 'view-tab'}
                onClick={() => setView('week')}
              >
                Week
              </button>
            </div>

            <div className="date-hero-group">
              <button
                type="button"
                className="nav-arrow inline"
                aria-label={previousLabel}
                onClick={() =>
                  navigate({
                    to: '/day/$date',
                    params: { date: shiftIsoDate(board.day, -navStep) },
                    search: { edit: undefined },
                  })
                }
              >
                <svg viewBox="0 0 20 20" width="20" height="20" focusable="false" aria-hidden="true">
                  <path
                    d="M12.5 5 7.5 10l5 5"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.7"
                  />
                </svg>
              </button>

              <div className="date-title-picker">
                <button
                  type="button"
                  className="date-picker-trigger"
                  onClick={openDatePicker}
                  aria-label="Pick date"
                >
                  <span className="date-hero-title">
                    {weekNumber !== null ? (
                      <span className="week-eyebrow">Week {weekNumber}</span>
                    ) : null}
                    <span>{heroLabel}</span>
                  </span>
                </button>
                <input
                  ref={datePickerRef}
                  aria-label="Selected day"
                  type="date"
                  value={board.day}
                  onChange={(event) =>
                    navigate({
                      to: '/day/$date',
                      params: { date: event.target.value },
                      search: { edit: undefined },
                    })
                  }
                />
              </div>

              <button
                type="button"
                className="nav-arrow inline"
                aria-label={nextLabel}
                onClick={() =>
                  navigate({
                    to: '/day/$date',
                    params: { date: shiftIsoDate(board.day, navStep) },
                    search: { edit: undefined },
                  })
                }
              >
                <svg viewBox="0 0 20 20" width="20" height="20" focusable="false" aria-hidden="true">
                  <path
                    d="m7.5 5 5 5-5 5"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.7"
                  />
                </svg>
              </button>
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
                  className={
                    categoryFilter === category.id ? 'filter-pill active' : 'filter-pill'
                  }
                  style={categoryAccentStyle(category.color)}
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
        </div>

        {view === 'day' ? (
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={handleDragStart}
            onDragEnd={(event) => {
              void handleDragEnd(event)
            }}
            onDragCancel={() => setActiveTaskId(null)}
          >
            <div className="board-columns minimal">
              {visibleColumns.map((column) => (
                <StatusColumn
                  key={column.status.id}
                  column={column}
                  onSelectTask={(task) => setSelectedTaskId(task.id)}
                  onQuickComplete={(task) => void handleQuickComplete(task)}
                  doneStatusId={doneStatusId}
                  activeTaskId={activeTaskId}
                />
              ))}
            </div>
            <DragOverlay dropAnimation={{ duration: 130, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }}>
              {activeTask ? (
                <article className="task-card drag-overlay-card">
                  <div className="task-main">
                    <div className="task-heading">
                      <h4>{activeTask.title}</h4>
                    </div>
                    {activeTask.description ? <p>{activeTask.description}</p> : null}
                    {activeTask.categories.length > 0 ? (
                      <div className="task-pill-row">
                        {activeTask.categories.map((category) => (
                          <span
                            key={category.id}
                            className="category-badge"
                            style={categoryAccentStyle(category.color)}
                          >
                            {category.name}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </article>
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <div className="week-grid">
            {week.days.map((day) => (
              <WeekDayCard
                key={day.day}
                day={day}
                isSelected={day.day === board.day}
                doneStatusId={doneStatusId}
                onSelectDay={() =>
                  navigate({
                    to: '/day/$date',
                    params: { date: day.day },
                    search: { edit: undefined },
                  })
                }
                onOpenDay={() => {
                  setView('day')
                  navigate({
                    to: '/day/$date',
                    params: { date: day.day },
                    search: { edit: undefined },
                  })
                }}
                onSelectTask={(task) => setSelectedTaskId(task.id)}
                onQuickAdd={() => openComposerForNewTask({ day: day.day })}
              />
            ))}
          </div>
        )}

        <button
          type="button"
          className="floating-add"
          aria-label="Add task"
          onClick={() => openComposerForNewTask()}
        >
          <svg viewBox="0 0 20 20" focusable="false">
            <path
              d="M10 4v12M4 10h12"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
            />
          </svg>
          <span>Add task</span>
        </button>
      </section>

      <TaskEditorDrawer
        open={isComposerOpen}
        draft={draft}
        setDraft={setDraft}
        statuses={board.allStatuses}
        categories={board.allCategories}
        onClose={closeComposer}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
      />
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
              statusColor={column.status.color}
              onSelect={() => onSelectTask(task)}
              onQuickComplete={() => onQuickComplete(task)}
              onEdit={() => onSelectTask(task)}
              doneStatusId={doneStatusId}
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
  statusColor,
  onSelect,
  onQuickComplete,
  onEdit,
  doneStatusId,
  isDraggingTask,
}: {
  task: TaskRecord
  statusColor: string
  onSelect: () => void
  onQuickComplete: () => void
  onEdit: () => void
  doneStatusId: string | null
  isDraggingTask: boolean
}) {
  const showCompleteControl = doneStatusId != null
  const isCompleted = doneStatusId != null && task.statusId === doneStatusId

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
        ...taskStatusAccentStyle(statusColor),
      }}
      className={isDragging ? 'task-card dragging' : 'task-card'}
      {...attributes}
      {...listeners}
    >
      <div
        className="task-main"
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onSelect()
          }
        }}
      >
        <div className="task-heading">
          <h4>{task.title}</h4>
          <div className="task-trailing">
            {showCompleteControl ? (
              <button
                type="button"
                className="complete-toggle"
                aria-label={isCompleted ? `${task.title} completed` : `Mark ${task.title} done`}
                title={isCompleted ? 'Completed' : 'Mark done'}
                disabled={isCompleted}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation()
                }}
              >
                <input
                  type="checkbox"
                  className="complete-checkbox"
                  aria-label={isCompleted ? `${task.title} completed` : `Complete ${task.title}`}
                  checked={isCompleted}
                  disabled={isCompleted}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => {
                    event.stopPropagation()
                    if (!isCompleted) {
                      onQuickComplete()
                    }
                  }}
                />
                <span>{isCompleted ? 'Completed' : 'Mark completed'}</span>
              </button>
            ) : null}
            <button
              type="button"
              className="icon-button subdued"
              aria-label={`Edit ${task.title}`}
              title="Edit task"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                onEdit()
              }}
            >
              <svg viewBox="0 0 20 20" focusable="false">
                <path
                  d="m4 13.75 8.8-8.8a1.6 1.6 0 0 1 2.27 0l.98.98a1.6 1.6 0 0 1 0 2.27L7.25 17H4z"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                />
              </svg>
            </button>
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
              <span
                key={category.id}
                className="category-badge"
                style={categoryAccentStyle(category.color)}
              >
                {category.name}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  )
}
