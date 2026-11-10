import { useState } from 'react'
import { codeLines, type HeredocBody, markPlaceholders } from '~/lib/highlight'
import { cn } from '~/lib/utils'
import { Code } from './code'
import { CopyButton } from './copy-button'
import { ScrollArea } from './ui/scroll-area'

/** Longer than this, a block shows its first lines and a button for the rest. */
const FOLD_AFTER = 12
const FOLDED_LINES = 8

/**
 * Commands to paste, highlighted, under a bar with their language and one button that copies all
 * of them. Nothing but the commands is in the block, so selecting it by hand copies them too.
 */
export function CodeBlock({
  code,
  lang = 'shell',
  body,
  placeholders = [],
  label = 'Copy',
  className,
}: {
  code: string
  lang?: string
  /** What any heredoc in the commands carries. */
  body?: HeredocBody
  /** Words to replace before running, such as a file name: marked wherever they appear. */
  placeholders?: readonly string[]
  label?: string
  className?: string
}) {
  const lines = codeLines(code, body).map((tokens) => markPlaceholders(tokens, placeholders))
  const foldable = lines.length > FOLD_AFTER
  const [open, setOpen] = useState(false)
  const shown = foldable && !open ? lines.slice(0, FOLDED_LINES) : lines

  return (
    <div
      className={cn(
        // On phones the block runs to the screen's edges, past the page's padding, for room.
        'min-w-0 overflow-hidden rounded-lg border bg-muted max-sm:-mx-5 max-sm:rounded-none max-sm:border-x-0',
        className,
      )}
    >
      <div className="flex h-10 items-center justify-between border-b pr-2 pl-5">
        <span className="font-mono text-faint text-xs">{lang}</span>
        <CopyButton value={code} label={label} />
      </div>
      <div className="relative">
        {/*
          Long lines scroll sideways. The scrollbar is drawn inside the block, in the page's own
          colours, and is there whenever the lines are wider than the block.
        */}
        <ScrollArea type="auto" orientation="horizontal">
          <pre className="px-5 py-4 font-mono text-[13px] leading-[1.7]">
            {shown.map((tokens, index) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: lines never reorder
                key={index}
                className="min-h-[1.7em] whitespace-pre"
              >
                <Code tokens={tokens} />
              </div>
            ))}
          </pre>
        </ScrollArea>
        {foldable && !open ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-muted" />
        ) : null}
      </div>
      {foldable ? (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="h-9 w-full border-t text-muted-foreground text-xs hover:text-foreground"
        >
          {open ? 'Show less' : `Show all ${lines.length} lines`}
        </button>
      ) : null}
    </div>
  )
}
