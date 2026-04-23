import { useState } from 'react'

export function SignInPage({
  error,
  onSubmit,
}: {
  error: string | null
  onSubmit: (password: string) => Promise<void>
}) {
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)

  return (
    <section className="signin-page">
      <div className="signin-card">
        <p className="eyebrow">Sign in</p>
        <h2>Enter the shared password</h2>
        <p className="subtle">This protects your PostgreSQL-backed board from anonymous traffic.</p>

        <form
          className="task-form"
          onSubmit={(event) => {
            event.preventDefault()
            if (!password.trim()) {
              return
            }
            setPending(true)
            void onSubmit(password).finally(() => {
              setPending(false)
            })
          }}
        >
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Shared password"
              required
            />
          </label>
          {error ? <p className="signin-error">{error}</p> : null}
          <button type="submit" className="primary" disabled={pending}>
            {pending ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </section>
  )
}
