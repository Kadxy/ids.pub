import { CheckIcon, CopyIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { FingerprintPopover } from '~/components/fingerprint-popover'
import type { KeyFacts } from '~/lib/key-facts'
import { cn } from '~/lib/utils'

/**
 * The line a server gets, as one box: a click anywhere on it copies the whole line. The copy icon
 * in its corner shows on hover (always, on touch screens) and turns into a tick for a moment. Under the box, as
 * its caption, the key's fingerprint, with the button for its randomart right after it.
 */
export function PublicKeyBlock({
  line,
  name,
  facts,
}: {
  line: string
  /** The key's title, for the randomart's label. */
  name: string
  facts: KeyFacts
}) {
  const [key, comment] = splitLine(line)
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(line)
    } catch {
      toast.error("Couldn't copy. Your browser blocked access to the clipboard.")
      return
    }
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={copy}
        aria-label="Copy public key"
        title="Copy"
        className="group relative block w-full rounded-xl border bg-card py-3 pr-11 pl-4 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
      >
        {/* The key itself breaks anywhere, like a terminal; the comment breaks only between words. */}
        <code className="block text-[12.5px] text-muted-foreground leading-5">
          <span className="break-all">{key}</span>
          {comment ? (
            <span className="text-foreground [overflow-wrap:anywhere]"> {comment}</span>
          ) : null}
        </code>
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-2.5 right-2.5 grid size-6 place-items-center rounded-md transition-colors [&_svg]:size-3.5',
            copied
              ? 'text-foreground'
              : 'text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 pointer-coarse:opacity-100',
          )}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </span>
        <span role="status" className="sr-only">
          {copied ? 'Copied' : ''}
        </span>
      </button>
      <p className="flex min-w-0 items-center gap-0.5 text-muted-foreground">
        <span className="min-w-0 break-all font-mono text-xs">{facts.fingerprint}</span>
        <FingerprintPopover name={name} facts={facts} withFingerprint={false} small align="start" />
      </p>
    </div>
  )
}

/** `ssh-ed25519 AAAA… you@laptop` as the key part and the comment. */
function splitLine(line: string): [string, string] {
  const match = /^(\S+ \S+)(?: (.*))?$/.exec(line)
  return match ? [match[1] ?? line, match[2] ?? ''] : [line, '']
}
