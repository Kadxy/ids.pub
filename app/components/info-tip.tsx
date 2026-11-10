import { InfoIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

/** Help text kept out of the way: an icon that explains on hover or focus. */
export function InfoTip({
  children,
  label = 'More information',
}: {
  children: ReactNode
  label?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="inline-grid size-4 place-items-center rounded-full text-faint hover:text-foreground"
        >
          <InfoIcon className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-pretty">{children}</TooltipContent>
    </Tooltip>
  )
}
