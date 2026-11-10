import { NavLink } from 'react-router'
import { cn } from '~/lib/utils'

export interface Tab {
  to: string
  label: string
  count?: number
  /** Only active on exactly this path, not below it. */
  end?: boolean
}

/**
 * A row of tabs within a page, the active one underlined. The underline is drawn over the border
 * below the row, so it reads as part of that line.
 */
export function TabNav({
  label,
  tabs,
  keepScroll,
  className,
}: {
  label: string
  tabs: Tab[]
  /** Switching tabs keeps the scroll position, for tabs within one page. */
  keepScroll?: boolean
  className?: string
}) {
  return (
    <nav aria-label={label} className={cn('flex items-stretch gap-5', className)}>
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          prefetch="intent"
          preventScrollReset={keepScroll}
          className="relative flex select-none items-center gap-1.5 py-2.5 font-medium text-muted-foreground text-sm transition-colors after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full hover:text-foreground aria-[current=page]:text-foreground aria-[current=page]:after:bg-foreground"
        >
          {tab.label}
          {tab.count !== undefined ? (
            <span className="font-normal text-faint tabular-nums">{tab.count}</span>
          ) : null}
        </NavLink>
      ))}
    </nav>
  )
}
