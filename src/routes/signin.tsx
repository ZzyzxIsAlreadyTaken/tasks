import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { SignInPage } from '~/components/SignInPage'
import { getTodayIsoDate } from '~/lib/dates'
import { loadAuthState, signInWithPassword } from '~/server/auth-functions'

export const Route = createFileRoute('/signin')({
  validateSearch: (search: Record<string, unknown>) => ({
    error: typeof search.error === 'string' ? search.error : undefined,
  }),
  loader: async () => {
    const auth = await loadAuthState()
    if (auth.signedIn) {
      throw redirect({
        to: '/day/$date',
        params: { date: getTodayIsoDate() },
        search: { edit: undefined },
      })
    }
  },
  component: SignInRouteComponent,
})

function SignInRouteComponent() {
  const navigate = useNavigate()
  const { error } = Route.useSearch()

  async function handleSubmit(password: string) {
    const result = await signInWithPassword({ data: { password } })

    if (!result.ok) {
      await navigate({
        to: '/signin',
        search: { error: 'invalid' },
        replace: true,
      })
      return
    }

    await navigate({
      to: '/day/$date',
      params: { date: getTodayIsoDate() },
      search: { edit: undefined },
    })
  }

  return (
    <SignInPage
      error={error === 'invalid' ? 'That password is not valid.' : null}
      onSubmit={handleSubmit}
    />
  )
}
