import type { ReactNode } from 'react'
import { cn } from '~/lib/utils'
import { InfoTip } from './info-tip'

/** One setting: a short title on the left (help, if any, behind an icon), the control on the right. */
export function SettingsRow({
  title,
  help,
  description,
  children,
  tone,
}: {
  title: string
  help?: ReactNode
  description?: ReactNode
  children: ReactNode
  tone?: 'danger'
}) {
  return (
    <section className="grid gap-x-8 gap-y-2.5 py-5 md:grid-cols-[10rem_minmax(0,1fr)]">
      <div className="min-w-0 md:pt-1.5">
        <h2
          className={cn(
            'flex items-center gap-1.5 font-medium text-sm',
            tone === 'danger' && 'text-destructive',
          )}
        >
          {title}
          {help ? <InfoTip label={`About ${title.toLowerCase()}`}>{help}</InfoTip> : null}
        </h2>
        {description ? <p className="mt-1 text-muted-foreground text-sm">{description}</p> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  )
}
