import { PencilIcon } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
import { data, redirect, useFetcher } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDeleteDialog } from '~/components/console/confirm-delete-dialog'
import { DangerZone } from '~/components/console/edit-controls'
import { FieldBlock } from '~/components/console/field-block'
import { IconGrid } from '~/components/console/icon-grid'
import { NoteInput } from '~/components/console/note-input'
import { PublicKeyBlock } from '~/components/console/public-key-preview'
import { GroupRow, ResourceTable } from '~/components/console/resource-list'
import type { ActionResult } from '~/components/console/types'
import { GrowingTextarea } from '~/components/growing-textarea'
import { InfoTip } from '~/components/info-tip'
import { KeyAvatar } from '~/components/key-avatar'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { envOf } from '~/context'
import { useFetcherResult } from '~/hooks/use-fetcher-result'
import { fail, signedInAccount, withFacts } from '~/lib/console.server'
import { removeKey, updateKey } from '~/lib/db.server'
import {
  cleanKeyName,
  cleanNote,
  isKeyIcon,
  type KeyIcon,
  keyPath,
  keyTitle,
  LIMITS,
} from '~/lib/directory'
import { formatDate } from '~/lib/key-facts'
import { cachedLoader, forgettingAction } from '~/lib/page-cache'
import { authorizedKeysLine, cleanComment, lineFits } from '~/lib/ssh-key'
import { cn } from '~/lib/utils'
import type { Route } from './+types/key'

export const meta: Route.MetaFunction = ({ loaderData }) => [
  {
    title: loaderData
      ? `${keyTitle(loaderData.key, loaderData.key.facts.algorithm)} – ids.pub`
      : 'Keys – ids.pub',
  },
]

export async function loader({ params, context }: Route.LoaderArgs) {
  // Ids had a key_ prefix before migration 0014; old links go to the page under its id now.
  if (params.id.startsWith('key_')) throw redirect(keyPath(params.id.slice('key_'.length)))
  const account = await signedInAccount(context)
  const stored = account.keys.find((key) => key.id === params.id)
  if (!stored) throw data(null, { status: 404 })
  const [key] = await withFacts([stored])
  if (!key) throw data(null, { status: 404 })
  return {
    key,
    groups: account.keysets
      .filter((keyset) => stored.keysets.includes(keyset.slug))
      .map((keyset) => ({ slug: keyset.slug, createdAt: keyset.createdAt })),
  }
}

/** Back on this page, show it as it was and refresh it quietly; see ~/lib/page-cache. */
export const clientLoader = (args: Route.ClientLoaderArgs) => cachedLoader(args)
export const clientAction = (args: Route.ClientActionArgs) => forgettingAction(args)

export async function action({ request, params, context }: Route.ActionArgs) {
  const db = envOf(context).DB
  const account = await signedInAccount(context)
  const stored = account.keys.find((entry) => entry.id === params.id)
  if (!stored) return fail('This key no longer exists.', 404)
  const form = await request.formData()

  switch (form.get('intent')) {
    case 'save': {
      const note = cleanNote(String(form.get('note') ?? ''))
      if (note.length > LIMITS.note) return fail(`Keep the note under ${LIMITS.note} characters.`)
      const comment = cleanComment(String(form.get('comment') ?? ''))
      if (!lineFits(stored, comment)) {
        return fail('The line is longer than the 8 KB that OpenSSH reads. Shorten the comment.')
      }
      await updateKey(db, account.id, stored.id, {
        name: cleanKeyName(String(form.get('name') ?? '')),
        comment,
        note,
      })
      return { ok: true, intent: 'save' } satisfies ActionResult
    }
    // The icon is picked like a profile picture: it applies as soon as it is chosen.
    case 'icon': {
      const icon = form.get('icon')
      if (!isKeyIcon(icon)) return fail('Unknown icon.')
      await updateKey(db, account.id, stored.id, { icon })
      return { ok: true, intent: 'icon' } satisfies ActionResult
    }
    case 'delete': {
      const [key] = await withFacts([stored])
      const title = keyTitle(stored, key?.facts.algorithm ?? '')
      if (form.get('confirm') !== title) return fail(`Type ${title} to confirm.`)
      await removeKey(db, account.id, stored.id)
      return redirect(`/keys?deleted=${encodeURIComponent(title)}`)
    }
    default:
      return fail('Unknown action.')
  }
}

interface Draft {
  name: string
  comment: string
  note: string
}

/**
 * A key's page is its form, as a group's page and Settings are: change anything, then Save, which
 * shows at the top right once something changed. The public key follows the comment as it is
 * typed. The icon applies as soon as it is picked.
 */
export default function KeyPage({ loaderData }: Route.ComponentProps) {
  const { key, groups } = loaderData
  const ids = { name: useId(), comment: useId(), note: useId() }
  const fetcher = useFetcher<ActionResult>()
  const [deleting, setDeleting] = useState(false)
  const saved = useMemo<Draft>(
    () => ({ name: key.name, comment: key.comment, note: key.note }),
    [key],
  )
  const [draft, setDraft] = useState(saved)
  // A save, or another key, brings back what is stored; start over from it.
  useEffect(() => setDraft(saved), [saved])
  const set = <K extends keyof Draft>(field: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [field]: value }))
  const changed = (['name', 'comment', 'note'] as const).some(
    (field) => saved[field].trim() !== draft[field].trim(),
  )
  const title = keyTitle(key, key.facts.algorithm)

  useFetcherResult(fetcher, (result) => {
    if (result.ok) toast('Saved')
    else toast.error(result.error)
  })

  return (
    <>
      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="save" />
        <header className="flex items-center gap-4">
          <IconPicker keyId={key.id} icon={key.icon} />
          <div className="min-w-0 flex-1">
            <h1
              title={title}
              className={cn(
                'truncate font-semibold text-xl leading-7 tracking-[-0.015em]',
                !key.name.trim() && !key.comment.trim() && 'text-muted-foreground',
              )}
            >
              {title}
            </h1>
            <p className="text-[13px] text-muted-foreground leading-5">
              Added on {formatDate(key.addedAt)}
            </p>
          </div>
          {changed ? (
            <Button type="submit" className="shrink-0" disabled={fetcher.state !== 'idle'}>
              Save
            </Button>
          ) : null}
        </header>

        <div className="mt-8 grid gap-6">
          <FieldBlock label="Public key">
            <PublicKeyBlock
              line={authorizedKeysLine(key, draft.comment)}
              name={title}
              facts={key.facts}
            />
          </FieldBlock>

          <div className="grid gap-1.5">
            <label htmlFor={ids.name} className="font-medium text-sm">
              Name
            </label>
            <Input
              id={ids.name}
              name="name"
              value={draft.name}
              onChange={(event) => set('name', event.target.value)}
              maxLength={LIMITS.keyName}
              autoComplete="off"
              placeholder={key.comment || `${key.facts.algorithm} key`}
              className="h-9"
            />
          </div>

          <div className="grid gap-1.5">
            <span className="flex items-center gap-1.5">
              <label htmlFor={ids.comment} className="font-medium text-sm">
                Comment
              </label>
              <InfoTip label="About comment">
                Not used by SSH, but may be convenient for identifying the key.
              </InfoTip>
            </span>
            <GrowingTextarea
              id={ids.comment}
              name="comment"
              value={draft.comment}
              onChange={(event) => set('comment', event.target.value)}
              singleLine
              autoComplete="off"
              spellCheck={false}
              placeholder="you@laptop"
              className="font-mono text-[13px] md:text-[13px]"
            />
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

          <FieldBlock label="Groups">
            {groups.length === 0 ? (
              <p className="text-faint text-sm">No groups</p>
            ) : (
              <ResourceTable head={['Name', 'Created']}>
                {groups.map((group) => (
                  <GroupRow key={group.slug} group={group} />
                ))}
              </ResourceTable>
            )}
          </FieldBlock>
        </div>
      </fetcher.Form>

      <DangerZone
        className="mt-6"
        title="Delete this key"
        description="ids.pub stops returning it right away."
        action="Delete key"
        onClick={() => setDeleting(true)}
      />

      <ConfirmDeleteDialog
        open={deleting}
        onOpenChange={setDeleting}
        what="key"
        name={title}
        consequence={
          <>
            ids.pub stops returning it right away. Servers where you added it by hand keep it until
            you remove it there.
          </>
        }
      />
    </>
  )
}

/**
 * The key's picture. Hovering it shows a pencil; a click opens the icon and colour picker, and each
 * pick applies at once, as a profile picture would. No need to press Edit.
 */
function IconPicker({ keyId, icon: stored }: { keyId: string; icon: KeyIcon }) {
  const fetcher = useFetcher<ActionResult>({ key: `icon-${keyId}` })
  const picked = fetcher.formData?.get('icon')
  const icon = isKeyIcon(picked) ? picked : stored
  useFetcherResult(fetcher, (result) => {
    if (!result.ok) toast.error(result.error)
  })

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Change icon"
          className="group relative shrink-0 rounded-[14px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <KeyAvatar icon={icon} size="lg" />
          <span className="absolute inset-0 grid place-items-center rounded-[14px] bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 group-data-[state=open]:opacity-100">
            <PencilIcon aria-hidden="true" className="size-4" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-3">
        <IconGrid
          value={icon}
          onChange={(next) => fetcher.submit({ intent: 'icon', icon: next }, { method: 'post' })}
        />
      </PopoverContent>
    </Popover>
  )
}
