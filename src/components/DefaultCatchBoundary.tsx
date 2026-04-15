import type { ErrorComponentProps } from '@tanstack/react-router'

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const message = error instanceof Error ? error.message : 'Unknown error'

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-3xl flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
        Something Broke
      </p>
      <h1 className="text-4xl font-semibold text-[var(--ink)]">
        The board hit a snag.
      </h1>
      <p className="max-w-xl text-base text-[var(--muted)]">{message}</p>
    </div>
  )
}
