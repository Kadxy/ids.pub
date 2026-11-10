import { redirect } from 'react-router'
import { GroupForm } from '~/components/console/group-form'
import { envOf } from '~/context'
import { fail, signedInAccount, withFacts } from '~/lib/console.server'
import { createKeyset, saveKeyset } from '~/lib/db.server'
import { cleanNote, LIMITS } from '~/lib/directory'
import { keysetSlugProblem, normalizeName } from '~/lib/names'
import { cachedLoader, forgettingAction } from '~/lib/page-cache'
import type { Route } from './+types/groups.new'

export const meta: Route.MetaFunction = () => [{ title: 'New group – ids.pub' }]

export async function loader({ context }: Route.LoaderArgs) {
  const account = await signedInAccount(context)
  return {
    name: account.name,
    groups: account.keysets.map((keyset) => keyset.slug),
    keys: await withFacts(account.keys),
  }
}

/** Back on this page, show it as it was and refresh it quietly; see ~/lib/page-cache. */
export const clientLoader = (args: Route.ClientLoaderArgs) => cachedLoader(args)
export const clientAction = (args: Route.ClientActionArgs) => forgettingAction(args)

export async function action({ request, context }: Route.ActionArgs) {
  const db = envOf(context).DB
  const account = await signedInAccount(context)
  const form = await request.formData()
  if (account.keysets.length >= LIMITS.keysets) {
    return fail(`An account can have up to ${LIMITS.keysets} groups. Delete one first.`)
  }
  const slug = normalizeName(String(form.get('slug') ?? ''))
  const problem = keysetSlugProblem(
    slug,
    account.keysets.map((keyset) => keyset.slug),
  )
  if (problem) return fail(problem)
  const note = cleanNote(String(form.get('note') ?? ''))
  if (note.length > LIMITS.note) return fail(`Keep the note under ${LIMITS.note} characters.`)
  if ((await createKeyset(db, account.id, slug)) === 'taken') {
    return fail(`You already have a group called ${slug}.`)
  }
  const owned = new Set(account.keys.map((key) => key.id))
  await saveKeyset(db, account.id, slug, {
    slug,
    note,
    keyIds: form
      .getAll('key')
      .map(String)
      .filter((id) => owned.has(id)),
  })
  return redirect(`/groups/${slug}?created=1`)
}

/**
 * A page of its own, as GitHub's New repository: the address first, with the account's part fixed
 * in front of the name, then the note and the keys. A group's own page is the same form.
 */
export default function NewGroup({ loaderData }: Route.ComponentProps) {
  const { name, groups, keys } = loaderData
  return (
    <GroupForm
      title="New group"
      description="A group has its own address that returns only the keys in it."
      name={name ?? ''}
      others={groups}
      keys={keys}
      saved={null}
    />
  )
}
