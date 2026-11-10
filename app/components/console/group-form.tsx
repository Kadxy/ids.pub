import { type ReactNode, useEffect, useId, useState } from 'react'
import { Link, useFetcher } from 'react-router'
import { toast } from 'sonner'
import { InfoTip } from '~/components/info-tip'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { useFetcherResult } from '~/hooks/use-fetcher-result'
import { KEYSET_SLUG_MAX_LENGTH, keysetSlugProblem } from '~/lib/names'
import { displayAddress } from '~/lib/site'
import { KeyPicker } from './key-picker'
import { NoteInput } from './note-input'
import type { ActionResult, ConsoleKey } from './types'

export interface GroupValues {
  slug: string
  note: string
  keyIds: string[]
}

/**
 * A group's address, note and keys, as one page-long form, after GitHub's New repository. The New
 * group page ends in Create group and Cancel. A group's own page is this form from the start, with
 * Save at the top right once something changed, as on Settings and a key's page. `saved` must keep its identity
 * between renders: a new one starts the form over.
 */
export function GroupForm({
  title,
  description,
  name,
  others,
  keys,
  saved,
}: {
  title: ReactNode
  description?: ReactNode
  /** The account's username, fixed in front of the group's name in its address. */
  name: string
  /** The account's other groups, whose names are taken. */
  others: string[]
  keys: ConsoleKey[]
  /** What is stored; null for a group not made yet. */
  saved: GroupValues | null
}) {
  const ids = { slug: useId(), note: useId() }
  const fetcher = useFetcher<ActionResult>()
  const empty: GroupValues = { slug: '', note: '', keyIds: [] }
  const [draft, setDraft] = useState(saved ?? empty)
  // A save brings back what is stored; start over from it.
  useEffect(() => {
    if (saved) setDraft(saved)
  }, [saved])
  const set = <K extends keyof GroupValues>(field: K, value: GroupValues[K]) =>
    setDraft((current) => ({ ...current, [field]: value }))

  useFetcherResult(fetcher, (result) => {
    if (result.ok) toast('Saved')
    else toast.error(result.error)
  })

  const problem = draft.slug === '' ? null : keysetSlugProblem(draft.slug, others)
  const changed =
    !saved ||
    draft.slug !== saved.slug ||
    draft.note.trim() !== saved.note ||
    draft.keyIds.length !== saved.keyIds.length ||
    draft.keyIds.some((id) => !saved.keyIds.includes(id))
  const ready = draft.slug !== '' && !problem && changed && fetcher.state === 'idle'

  return (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value="save" />
      {draft.keyIds.map((id) => (
        <input key={id} type="hidden" name="key" value={id} />
      ))}

      <header className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-semibold text-[22px] leading-8 tracking-[-0.015em]">
            {title}
          </h1>
          {description ? <p className="mt-1 text-muted-foreground text-sm">{description}</p> : null}
        </div>
        {saved && changed ? (
          <Button type="submit" className="shrink-0" disabled={!ready}>
            Save
          </Button>
        ) : null}
      </header>

      <div className="mt-8 grid gap-6">
        <div className="grid gap-1.5">
          <label htmlFor={ids.slug} className="font-medium text-sm">
            Name
          </label>
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 font-mono text-[13px] text-muted-foreground">
              {displayAddress(name)}/
            </span>
            <Input
              id={ids.slug}
              name="slug"
              value={draft.slug}
              onChange={(event) => set('slug', event.target.value.toLowerCase())}
              maxLength={KEYSET_SLUG_MAX_LENGTH}
              spellCheck={false}
              autoCapitalize="none"
              autoComplete="off"
              autoFocus={!saved}
              placeholder="web-servers"
              aria-invalid={Boolean(problem) || undefined}
              className="h-9 max-w-xs font-mono text-[13px] md:text-[13px]"
            />
          </div>
          {problem ? <p className="text-destructive text-sm">{problem}</p> : null}
        </div>

        <div className="grid gap-1.5">
          <span className="flex items-center gap-1.5">
            <label htmlFor={ids.note} className="font-medium text-sm">
              Note
            </label>
            <InfoTip label="About note">Only visible to you.</InfoTip>
          </span>
          <NoteInput id={ids.note} value={draft.note} onChange={(note) => set('note', note)} />
        </div>

        <KeyPicker
          label="Keys"
          keys={keys}
          value={draft.keyIds}
          onChange={(next) => set('keyIds', next)}
        />

        {saved ? null : (
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={!ready}>
              Create group
            </Button>
            <Button asChild variant="ghost">
              <Link to="/groups">Cancel</Link>
            </Button>
          </div>
        )}
      </div>
    </fetcher.Form>
  )
}
