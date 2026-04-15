export function NotFound() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-3xl flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
        Not Found
      </p>
      <h1 className="text-4xl font-semibold text-[var(--ink)]">
        That page does not exist.
      </h1>
      <p className="max-w-xl text-base text-[var(--muted)]">
        Try heading back to today&apos;s board and we&apos;ll keep moving from
        there.
      </p>
    </div>
  )
}
