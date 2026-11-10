import { useEffect, useId, useMemo, useState } from 'react'
import { redirect, useFetcher } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDeleteDialog } from '~/components/console/confirm-delete-dialog'
import { DangerZone } from '~/components/console/edit-controls'
import { SettingsSection } from '~/components/console/settings-section'
import type { ActionResult } from '~/components/console/types'
import { NameStatus } from '~/components/name-status'
import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
import { Input } from '~/components/ui/input'
import { envOf } from '~/context'
import { useFetcherResult } from '~/hooks/use-fetcher-result'
import { useNameCheck } from '~/hooks/use-name-check'
import { endSession } from '~/lib/auth.server'
import { fail, signedInAccount } from '~/lib/console.server'
import { changeName, deleteAccount, setEarlierName, setPrivate } from '~/lib/db.server'
import type { Account } from '~/lib/directory'
import { formatDate } from '~/lib/key-facts'
import {
  NAME_MAX_LENGTH,
  nameProblem,
  normalizeName,
  RENAME_LIMIT,
  RENAME_WINDOW_DAYS,
  RENAMES_PER_WINDOW,
  unavailable,
} from '~/lib/names'
import { cachedLoader, forgettingAction } from '~/lib/page-cache'
import { displayAddress } from '~/lib/site'
import type { Route } from './+types/settings'

export const meta: Route.MetaFunction = () => [{ title: 'Settings – ids.pub' }]

/** The second thing to type before the account goes, after the username. */
const DELETE_ACCOUNT_PHRASE = 'delete my account'

/** Why the account can't change its username now, or null if it can. */
function renameBlocked(account: Pick<Account, 'renames'>): string | null {
  if (account.renames.length >= RENAME_LIMIT) {
    return `This account has used all ${RENAME_LIMIT} of its username changes.`
  }
  const window = RENAME_WINDOW_DAYS * 86_400_000
  const recent = account.renames.filter((at) => new Date(at).getTime() > Date.now() - window)
  if (recent.length < RENAMES_PER_WINDOW) return null
  // The oldest change that still counts leaves the window first.
  const oldest = recent[recent.length - RENAMES_PER_WINDOW] ?? ''
  return `You can change it again on ${formatDate(new Date(new Date(oldest).getTime() + window).toISOString())}.`
}

export async function loader({ context }: Route.LoaderArgs) {
  const account = await signedInAccount(context)
  return {
    name: account.name,
    // Most recent first.
    earlier: account.names
      .filter((entry) => entry.status !== 'current')
      .map((entry) => ({ name: entry.name, works: entry.status === 'active' }))
      .reverse(),
    blocked: renameBlocked(account),
    private: account.private,
    keys: account.keys.length,
    groups: account.keysets.length,
  }
}

/** Back on this page, show it as it was and refresh it quietly; see ~/lib/page-cache. */
export const clientLoader = (args: Route.ClientLoaderArgs) => cachedLoader(args)
export const clientAction = (args: Route.ClientActionArgs) => forgettingAction(args)

export async function action({ request, context }: Route.ActionArgs) {
  const env = envOf(context)
  const account = await signedInAccount(context)
  const form = await request.formData()

  switch (form.get('intent')) {
    case 'save': {
      const name = normalizeName(String(form.get('name') ?? ''))
      if (name !== account.name) {
        const problem = nameProblem(name)
        if (problem) return fail(problem)
        const blocked = renameBlocked(account)
        if (blocked) return fail(blocked)
        const result = await changeName(env.DB, account.id, name)
        if (result === 'taken') return fail(unavailable(name))
        if (result === 'refused')
          return fail('Your username changed a moment ago. Reload the page.')
      }
      // Only the earlier names the form showed; a name just left behind keeps working.
      const shown = new Set(form.getAll('earlier').map(String))
      const kept = new Set(form.getAll('keep').map(String))
      for (const entry of account.names) {
        if (entry.status === 'current') continue
        if (!shown.has(entry.name)) continue
        const works = kept.has(entry.name)
        if (works !== (entry.status === 'active')) {
          await setEarlierName(env.DB, account.id, entry.name, works)
        }
      }
      const hidden = form.get('private') === 'on'
      if (hidden !== account.private) await setPrivate(env.DB, account.id, hidden)
      return { ok: true, intent: 'save' } satisfies ActionResult
    }
    case 'delete': {
      if (form.get('phrase') !== DELETE_ACCOUNT_PHRASE) {
        return fail(`Type ${DELETE_ACCOUNT_PHRASE} to confirm.`)
      }
      if (!(await deleteAccount(env.DB, account.id, String(form.get('confirm') ?? '')))) {
        return fail(`Type ${account.name} to confirm.`)
      }
      return redirect('/', { headers: { 'set-cookie': await endSession(request, env) } })
    }
    default:
      return fail('Unknown action.')
  }
}

export default function Settings({ loaderData }: Route.ComponentProps) {
  const { name, earlier, blocked, keys, groups } = loaderData
  const ids = { name: useId(), private: useId() }
  const fetcher = useFetcher<ActionResult>()
  const [deleting, setDeleting] = useState(false)

  const saved = useMemo(
    () => ({
      name,
      keep: earlier.filter((entry) => entry.works).map((entry) => entry.name),
      private: loaderData.private,
    }),
    [name, earlier, loaderData.private],
  )
  const [draft, setDraft] = useState(saved)
  // A save brings back the stored settings; start over from them.
  useEffect(() => setDraft(saved), [saved])

  const typed = normalizeName(draft.name)
  const renaming = typed !== name
  const ownEarlier = earlier.some((entry) => entry.name === typed)
  const check = useNameCheck(renaming && !ownEarlier ? draft.name : '')
  const nameReady = !renaming || ownEarlier || check.status === 'free'
  const changed =
    renaming ||
    draft.private !== saved.private ||
    draft.keep.length !== saved.keep.length ||
    draft.keep.some((entry) => !saved.keep.includes(entry))

  useFetcherResult(fetcher, (result) => {
    if (result.ok) toast('Saved')
    else toast.error(result.error)
  })

  // A form from the start, as on GitHub. Save shows at the top right once something changed.
  return (
    <>
      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="save" />
        <header className="flex items-center gap-4">
          <h1 className="min-w-0 flex-1 font-semibold text-[22px] leading-8 tracking-[-0.015em]">
            Settings
          </h1>
          {changed ? (
            <Button
              type="submit"
              className="shrink-0"
              disabled={!nameReady || fetcher.state !== 'idle'}
            >
              Save
            </Button>
          ) : null}
        </header>

        <div className="mt-8 grid gap-8">
          <SettingsSection title="Username">
            <div className="grid max-w-60 gap-2">
              <label htmlFor={ids.name} className="sr-only">
                Username
              </label>
              <Input
                id={ids.name}
                name="name"
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    name: event.target.value.toLowerCase(),
                  }))
                }
                readOnly={Boolean(blocked)}
                maxLength={NAME_MAX_LENGTH}
                spellCheck={false}
                autoCapitalize="none"
                autoComplete="username"
                className="h-9"
              />
            </div>
            {blocked ? (
              <p className="text-muted-foreground text-sm">{blocked}</p>
            ) : renaming ? (
              <NameStatus state={ownEarlier ? { status: 'mine-earlier' } : check} />
            ) : null}
          </SettingsSection>

          {earlier.length > 0 ? (
            <SettingsSection
              title="Earlier usernames"
              description="A checked address keeps returning your keys. Either way it stays yours, and no one else can claim it."
            >
              <ul className="grid gap-2.5">
                {earlier.map((entry) => {
                  const id = `${ids.name}-${entry.name}`
                  const kept = draft.keep.includes(entry.name)
                  return (
                    <li key={entry.name} className="flex min-w-0 items-center gap-2.5">
                      <input type="hidden" name="earlier" value={entry.name} />
                      <Checkbox
                        id={id}
                        name="keep"
                        value={entry.name}
                        checked={kept}
                        onCheckedChange={(checked) =>
                          setDraft((current) => ({
                            ...current,
                            keep:
                              checked === true
                                ? [...current.keep, entry.name]
                                : current.keep.filter((other) => other !== entry.name),
                          }))
                        }
                      />
                      <label htmlFor={id} title={entry.name} className="truncate font-mono text-sm">
                        {displayAddress(entry.name)}
                      </label>
                    </li>
                  )
                })}
              </ul>
            </SettingsSection>
          ) : null}

          <SettingsSection title="Visibility">
            <div className="flex items-start gap-2.5">
              <Checkbox
                id={ids.private}
                name="private"
                checked={draft.private}
                onCheckedChange={(checked) =>
                  setDraft((current) => ({ ...current, private: checked === true }))
                }
                className="mt-0.5"
              />
              <label htmlFor={ids.private} className="grid gap-0.5 text-sm">
                <span>Private profile</span>
                <span className="text-muted-foreground">
                  Your addresses return nothing, to servers too. Your page shows only your username.
                </span>
              </label>
            </div>
          </SettingsSection>
        </div>
      </fetcher.Form>

      <DangerZone
        className="mt-8"
        title="Delete this account"
        description="Your keys and groups are deleted, and your usernames can never be used again."
        action="Delete account"
        onClick={() => setDeleting(true)}
      />

      <ConfirmDeleteDialog
        open={deleting}
        onOpenChange={setDeleting}
        what="account"
        name={name}
        phrase={DELETE_ACCOUNT_PHRASE}
        consequence={
          <>
            Your {keys === 1 ? 'key' : `${keys} keys`} and{' '}
            {groups === 1 ? 'group' : `${groups} groups`} are deleted right away, and your usernames
            can never be used again.
          </>
        }
      />
    </>
  )
}
