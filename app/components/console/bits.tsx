import { SearchIcon } from 'lucide-react'
import { forwardRef, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Input } from '~/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'
import { cn } from '~/lib/utils'

/** A tooltip naming what an icon-only button does. */
export function Hint({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export async function copyText(value: string, message: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast(message)
    return true
  } catch {
    toast.error("Couldn't copy. Your browser blocked access to the clipboard.")
    return false
  }
}

export const FilterInput = forwardRef<
  HTMLInputElement,
  { value: string; onChange: (value: string) => void; placeholder: string; className?: string }
>(function FilterInput({ value, onChange, placeholder, className }, ref) {
  return (
    <div className={cn('relative', className)}>
      <SearchIcon
        aria-hidden="true"
        className="-translate-y-1/2 absolute top-1/2 left-2.5 size-4 text-faint"
      />
      <Input
        ref={ref}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-8 pr-3 pl-8"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            onChange('')
            event.currentTarget.blur()
          }
        }}
      />
    </div>
  )
})

export const FILTER_THRESHOLD = 6
