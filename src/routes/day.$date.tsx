import { createFileRoute } from '@tanstack/react-router'
import { TaskBoardPage } from '~/components/TaskBoardPage'
import { loadBoard } from '~/server/task-board'

export const Route = createFileRoute('/day/$date')({
  validateSearch: (search: Record<string, unknown>) => ({
    edit: typeof search.edit === 'string' ? search.edit : undefined,
  }),
  loader: ({ params }) => loadBoard({ data: { day: params.date } }),
  component: DayRouteComponent,
})

function DayRouteComponent() {
  const data = Route.useLoaderData()
  const { edit } = Route.useSearch()
  return <TaskBoardPage initialData={data} initialEditTaskId={edit ?? null} />
}
