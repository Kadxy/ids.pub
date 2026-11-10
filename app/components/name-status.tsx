import { CheckIcon } from 'lucide-react'
import type { NameState } from '~/hooks/use-name-check'
import { unavailable } from '~/lib/names'

/** One line under a username field saying whether the name can be had. */
export function NameStatus({ state }: { state: NameState | { status: 'mine-earlier' } }) {
  switch (state.status) {
    case 'empty':
    case 'checking':
      return <p className="text-faint text-sm">Checking…</p>
    case 'problem':
      return <p className="text-destructive text-sm">{state.problem}</p>
    case 'free':
      return (
        <p className="flex items-center gap-1.5 text-sm text-success">
          <CheckIcon aria-hidden="true" className="size-4" />
          Available
        </p>
      )
    case 'mine-earlier':
      return <p className="text-muted-foreground text-sm">One of your earlier usernames.</p>
    case 'yours':
      return <p className="text-muted-foreground text-sm">That's your username.</p>
    case 'invalid':
    case 'reserved':
    case 'taken':
    case 'gone':
      return <p className="text-destructive text-sm">{unavailable(state.name)}</p>
  }
}
