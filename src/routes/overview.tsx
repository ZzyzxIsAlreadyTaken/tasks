import { createFileRoute } from '@tanstack/react-router'
import { OverviewPage } from '~/components/OverviewPage'
import { loadOverview } from '~/server/task-board'

export const Route = createFileRoute('/overview')({
  loader: () => loadOverview(),
  component: OverviewRouteComponent,
})

function OverviewRouteComponent() {
  const overview = Route.useLoaderData()
  return <OverviewPage overview={overview} />
}
