import { CheckIcon, CopyIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { cn } from '~/lib/utils'
import { Button } from './ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

/** The one copy button: an icon that turns into a tick for a moment once copied. */
export function CopyButton({
  value,
  label = 'Copy',
  className,
}: {
  value: string
  /** Accessible name and tooltip, such as "Copy command". */
  label?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      toast.error("Couldn't copy. Your browser blocked access to the clipboard.")
      return
    }
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1600)
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={copy}
          aria-label={label}
          className={cn(copied ? 'text-foreground' : 'text-muted-foreground', className)}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          <span role="status" className="sr-only">
            {copied ? 'Copied' : ''}
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{copied ? 'Copied' : label}</TooltipContent>
    </Tooltip>
  )
}
