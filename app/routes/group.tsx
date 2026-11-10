import { useMemo, useState } from 'react'
import { data, redirect } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDeleteDialog } from '~/components/console/confirm-delete-dialog'
import { DangerZone } from '~/components/console/edit-controls'
import { GroupForm } from '~/components/console/group-form'
import type { ActionResult } from '~/components/console/types'
import { envOf } from '~/context'
import { useFlashParam } from '~/hooks/use-flash-param'
import { fail, signedInAccount, withFacts } from '~/lib/console.server'
import { deleteKeyset, saveKeyset } from '~/lib/db.server'
import { cleanNote, LIMITS } from '~/lib/directory'
import { keysetSlugProblem, normalizeName } from '~/lib/names'
import { cachedLoader, forgettingAction } from '~/lib/page-cache'
import type { Route } from './+types/group'

export const meta: Route.MetaFunction = ({ params }) => [{ title: `${params.slug} – ids.pub` }]

export async function loader({ params, context }: Route.LoaderArgs) {
  const account = await signedInAccount(context)
  const keyset = account.keysets.find((entry) => entry.slug === params.slug)
  if (!keyset) throw data(null, { status: 404 })
  const keys = await withFacts(account.keys)
  return {
    name: account.name ?? '',
    slug: keyset.slug,
    note: keyset.note,
    keys,
    memberIds: keys.filter((key) => key.keysets.includes(keyset.slug)).map((key) => key.id),
    others: account.keysets.map((entry) => entry.slug).filter((slug) => slug !== keyset.slug),
  }
}

/** Back on this page, show it as it was and refresh it quietly; see ~/lib/page-cache. */
export const clientLoader = (args: Route.ClientLoaderArgs) => cachedLoader(args)
export const clientAction = (args: Route.ClientActionArgs) => forgettingAction(args)

export async function action({ request, params, context }: Route.ActionArgs) {
  const db = envOf(context).DB
  const account = await signedInAccount(context)
  const slugs = account.keysets.map((keyset) => keyset.slug)
  if (!slugs.includes(params.slug)) return fail('This group no longer exists.', 404)
  const form = await request.formData()

  switch (form.get('intent')) {
    case 'save': {
      const slug = normalizeName(String(form.get('slug') ?? ''))
      const problem = keysetSlugProblem(
        slug,
        slugs.filter((other) => other !== params.slug),
      )
      if (problem) return fail(problem)
      const note = cleanNote(String(form.get('note') ?? ''))
      if (note.length > LIMITS.note) return fail(`Keep the note under ${LIMITS.note} characters.`)
      const owned = new Set(account.keys.map((key) => key.id))
      const result = await saveKeyset(db, account.id, params.slug, {
        slug,
        note,
        keyIds: form
          .getAll('key')
          .map(String)
          .filter((id) => owned.has(id)),
      })
      if (result === 'taken') return fail(`You already have a group called ${slug}.`)
      // A new name is a new address: the old one is gone, so go to the new one.
      if (slug !== params.slug) return redirect(`/groups/${slug}?saved=1`)
      return { ok: true, intent: 'save' } satisfies ActionResult
    }
    case 'delete': {
      if (form.get('confirm') !== params.slug) return fail(`Type ${params.slug} to confirm.`)
      await deleteKeyset(db, account.id, params.slug)
      return redirect(`/groups?deleted=${encodeURIComponent(params.slug)}`)
    }
    default:
      return fail('Unknown action.')
  }
}

/** A group's page is its form, as Settings is: change anything, then Save at the top right. */
export default function GroupPage({ loaderData }: Route.ComponentProps) {
  const { name, slug, note, keys, memberIds, others } = loaderData
  const [deleting, setDeleting] = useState(false)
  const saved = useMemo(() => ({ slug, note, keyIds: memberIds }), [slug, note, memberIds])

  useFlashParam('created', () => toast('Created'))
  // A rename lands on the new address with ?saved=1.
  useFlashParam('saved', () => toast('Saved'))

  return (
    <>
      <GroupForm key={slug} title={slug} name={name} others={others} keys={keys} saved={saved} />

      <DangerZone
        className="mt-6"
        title="Delete this group"
        description="Its address stops returning keys. The keys stay on your account."
        action="Delete group"
        onClick={() => setDeleting(true)}
      />

      <ConfirmDeleteDialog
        open={deleting}
        onOpenChange={setDeleting}
        what="group"
        name={slug}
        consequence="Its address stops returning keys right away. The keys stay on your account."
      />
    </>
  )
}
