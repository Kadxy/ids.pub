import { shellTokens } from '~/lib/highlight'
import { Code } from './code'
import { CopyButton } from './copy-button'

/** A command someone will paste into a terminal. Shown without a prompt so it copies cleanly. */
export function Command({ value, label = 'Copy command' }: { value: string; label?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg border bg-muted py-1 pr-1 pl-4">
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap py-1.5 text-[13px] [scrollbar-width:none]">
        <Code tokens={shellTokens(value)} />
      </code>
      <CopyButton value={value} label={label} />
    </div>
  )
}
