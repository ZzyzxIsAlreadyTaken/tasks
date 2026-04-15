import { createFileRoute } from '@tanstack/react-router'
import { TaskBoardPage } from '~/components/TaskBoardPage'
import { loadBoard } from '~/server/task-board'

export const Route = createFileRoute('/day/$date')({
  loader: ({ params }) => loadBoard({ data: { day: params.date } }),
  component: DayRouteComponent,
})

function DayRouteComponent() {
  const data = Route.useLoaderData()
  return <TaskBoardPage initialData={data} />
}
