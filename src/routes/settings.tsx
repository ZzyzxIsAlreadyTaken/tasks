import { createFileRoute } from '@tanstack/react-router'
import { SettingsPage } from '~/components/SettingsPage'
import { loadSettings } from '~/server/task-board'

export const Route = createFileRoute('/settings')({
  loader: () => loadSettings(),
  component: SettingsRouteComponent,
})

function SettingsRouteComponent() {
  const settings = Route.useLoaderData()
  return <SettingsPage initialSettings={settings} />
}
