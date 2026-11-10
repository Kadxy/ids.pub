import type { ReactNode } from 'react'

/** Title, one line of context and the page's main action, the same on every console page. */
export function PageHeader({
  title,
  description,
  actions,
  before,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  before?: ReactNode
}) {
  return (
    <div className="mb-6">
      {before}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="font-semibold text-[22px] leading-7 tracking-[-0.015em]">{title}</h1>
          {description ? (
            <div className="mt-1 text-muted-foreground text-sm">{description}</div>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  )
}
