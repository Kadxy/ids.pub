import { ScanEyeIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { KeyFacts } from '~/lib/key-facts'
import { cn } from '~/lib/utils'
import { Randomart } from './randomart'
import { Button } from './ui/button'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'

/**
 * The key's ssh-keygen picture, on hover, or on a tap for phones. Where the fingerprint isn't
 * already on screen next to the button, it comes along.
 */
export function FingerprintPopover({
  name,
  facts,
  withFingerprint = true,
  align = 'end',
  small = false,
}: {
  name: string
  facts: KeyFacts
  withFingerprint?: boolean
  align?: 'start' | 'end'
  /** To sit inside a line of text without making it taller. */
  small?: boolean
}) {
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const hover = (next: boolean) => (event: React.PointerEvent) => {
    if (event.pointerType !== 'mouse') return
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(next), next ? 120 : 150)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Randomart of ${name}`}
          className={cn('text-muted-foreground', small && 'size-6 [&_svg]:size-3.5')}
          onPointerEnter={hover(true)}
          onPointerLeave={hover(false)}
        >
          <ScanEyeIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-auto max-w-[calc(100vw-2rem)]"
        onPointerEnter={hover(true)}
        onPointerLeave={hover(false)}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        {withFingerprint ? (
          <p className="max-w-[19rem] break-all font-mono text-[12.5px]">{facts.fingerprint}</p>
        ) : null}
        <Randomart art={facts.art} />
      </PopoverContent>
    </Popover>
  )
}
