import type { ReactNode } from 'react'
import { Button } from '~/components/ui/button'
import { cn } from '~/lib/utils'

/**
 * The last section of a key's, a group's or the account's page, as on GitHub: what deleting does,
 * and the button that asks to confirm it.
 */
export function DangerZone({
  title,
  description,
  action,
  onClick,
  className,
}: {
  title: string
  description: ReactNode
  action: string
  onClick: () => void
  /** Its distance from what is above, the same as between the page's other sections. */
  className?: string
}) {
  return (
    <section className={cn('grid gap-1.5', className)}>
      <h2 className="font-medium text-sm">Danger zone</h2>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-xl border border-destructive/30 px-4 py-3.5">
        <div className="min-w-0 flex-1 basis-64">
          <p className="font-medium text-sm">{title}</p>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onClick}
          className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          {action}
        </Button>
      </div>
    </section>
  )
}
