import { KeyRoundIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { AddKeyDialog } from '~/components/console/add-key-dialog'
import { FILTER_THRESHOLD, FilterInput } from '~/components/console/bits'
import { KeyRow, ResourceTable, ResourceTableEmpty } from '~/components/console/resource-list'
import type { ActionResult } from '~/components/console/types'
import { PageHeader } from '~/components/page-header'
import { Button } from '~/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '~/components/ui/empty'
import { envOf } from '~/context'
import { useFlashParam } from '~/hooks/use-flash-param'
import { fail, signedInAccount, withFacts } from '~/lib/console.server'
import { addKeys } from '~/lib/db.server'
import { cleanKeyName, cleanNote, guessIcon, LIMITS } from '~/lib/directory'
import { cachedLoader, forgettingAction } from '~/lib/page-cache'
import { PARSE_ERROR_MESSAGES } from '~/lib/parse-errors'
import { cleanComment, lineFits, parsePublicKey } from '~/lib/ssh-key'
import type { Route } from './+types/keys'

export const meta: Route.MetaFunction = () => [{ title: 'Keys – ids.pub' }]

export async function loader({ context }: Route.LoaderArgs) {
  const account = await signedInAccount(context)
  return { keys: await withFacts(account.keys) }
}

/** Back on this page, show it as it was and refresh it quietly; see ~/lib/page-cache. */
export const clientLoader = (args: Route.ClientLoaderArgs) => cachedLoader(args)
export const clientAction = (args: Route.ClientActionArgs) => forgettingAction(args)

export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.formData()
  const account = await signedInAccount(context)
  if (form.get('intent') !== 'add') return fail('Unknown action.')

  const lines = form.getAll('key').map(String)
  const names = form.getAll('name').map(String)
  const comments = form.getAll('comment').map(String)
  const notes = form.getAll('note').map(String)
  if (
    lines.length === 0 ||
    [names, comments, notes].some((values) => values.length !== lines.length)
  ) {
    return fail('Paste a public key.')
  }
  if (account.keys.length + lines.length > LIMITS.keys) {
    return fail(`An account can have up to ${LIMITS.keys} keys. Delete some before adding more.`)
  }
  const accepted: Parameters<typeof addKeys>[2] = []
  for (const [index, line] of lines.entries()) {
    const parsed = parsePublicKey(line)
    if (!parsed.ok) return fail(PARSE_ERROR_MESSAGES[parsed.error])
    const duplicate = account.keys.find((key) => key.base64 === parsed.key.base64)
    if (duplicate) return fail('You already added this key.')
    const note = cleanNote(notes[index] ?? '')
    if (note.length > LIMITS.note) return fail(`Keep the note under ${LIMITS.note} characters.`)
    // The comment field starts as the pasted line's comment and may have been changed.
    const comment = cleanComment(comments[index] ?? '')
    if (!lineFits(parsed.key, comment)) return fail(PARSE_ERROR_MESSAGES['too-long'])
    accepted.push({
      type: parsed.key.type,
      base64: parsed.key.base64,
      name: cleanKeyName(names[index] ?? ''),
      comment,
      note,
      icon: guessIcon({ type: parsed.key.type, comment }),
    })
  }
  if ((await addKeys(envOf(context).DB, account.id, accepted)) === 'duplicate') {
    return fail('One of these keys is already on your account.')
  }
  return {
    ok: true,
    intent: 'add',
    name: accepted.length === 1 ? 'a key' : `${accepted.length} keys`,
  } satisfies ActionResult
}

export default function Keys({ loaderData }: Route.ComponentProps) {
  const { keys } = loaderData
  const [adding, setAdding] = useState(false)
  const [filter, setFilter] = useState('')
  const showFilter = keys.length >= FILTER_THRESHOLD
  const query = filter.trim().toLowerCase()
  const shown = query
    ? keys.filter(
        (key) =>
          key.name.toLowerCase().includes(query) ||
          key.comment.toLowerCase().includes(query) ||
          key.note.toLowerCase().includes(query) ||
          key.facts.algorithm.toLowerCase().includes(query) ||
          key.keysets.some((slug) => slug.includes(query)),
      )
    : keys

  useFlashParam('deleted', (deleted) => toast(`Deleted ${deleted}`))

  const addButton = <Button onClick={() => setAdding(true)}>New SSH key</Button>

  return (
    <>
      <PageHeader title="Keys" actions={keys.length > 0 ? addButton : null} />

      {keys.length === 0 ? (
        <Empty className="rounded-xl border border-dashed py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <KeyRoundIcon />
            </EmptyMedia>
            <EmptyTitle>Add your first key</EmptyTitle>
            <EmptyDescription>Paste one, or import its .pub file.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>{addButton}</EmptyContent>
        </Empty>
      ) : (
        <>
          {showFilter ? (
            <div className="mb-4">
              <FilterInput value={filter} onChange={setFilter} placeholder="Filter keys" />
            </div>
          ) : null}
          <ResourceTable head={['Name', 'Type', 'Added']}>
            {shown.map((key) => (
              <KeyRow key={key.id} entry={key} />
            ))}
            {shown.length === 0 ? (
              <ResourceTableEmpty>No keys match “{filter}”.</ResourceTableEmpty>
            ) : null}
          </ResourceTable>
        </>
      )}

      <AddKeyDialog open={adding} onOpenChange={setAdding} keys={keys} />
    </>
  )
}
