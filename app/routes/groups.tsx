import { LayersIcon } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { GroupRow, ResourceTable } from '~/components/console/resource-list'
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
import { useFlashParam } from '~/hooks/use-flash-param'
import { signedInAccount, withFacts } from '~/lib/console.server'
import { keysIn, keyTitle } from '~/lib/directory'
import { cachedLoader } from '~/lib/page-cache'
import { displayAddress } from '~/lib/site'
import type { Route } from './+types/groups'

export const meta: Route.MetaFunction = () => [{ title: 'Groups – ids.pub' }]

export async function loader({ context }: Route.LoaderArgs) {
  const account = await signedInAccount(context)
  const keys = await withFacts(account.keys)
  return {
    name: account.name,
    groups: account.keysets.map((keyset) => {
      const members = new Set(keysIn(account, keyset.slug).map((key) => key.id))
      return {
        slug: keyset.slug,
        createdAt: keyset.createdAt,
        keys: keys
          .filter((key) => members.has(key.id))
          .map((key) => ({
            id: key.id,
            icon: key.icon,
            title: keyTitle(key, key.facts.algorithm),
          })),
      }
    }),
  }
}

/** Back on this page, show it as it was and refresh it quietly; see ~/lib/page-cache. */
export const clientLoader = (args: Route.ClientLoaderArgs) => cachedLoader(args)

export default function Groups({ loaderData }: Route.ComponentProps) {
  const { name, groups } = loaderData

  useFlashParam('deleted', (deleted) => toast(`Deleted ${deleted}`))

  const newButton = (
    <Button asChild>
      <Link to="/groups/new">New group</Link>
    </Button>
  )

  return (
    <>
      <PageHeader title="Groups" actions={groups.length > 0 ? newButton : null} />

      {groups.length === 0 ? (
        <Empty className="rounded-xl border border-dashed py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LayersIcon />
            </EmptyMedia>
            <EmptyTitle>Give each server only the keys it needs</EmptyTitle>
            <EmptyDescription>
              A group has its own address, like{' '}
              <span className="font-mono">{displayAddress(name, 'web-servers')}</span>, with only
              the keys you put in it.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>{newButton}</EmptyContent>
        </Empty>
      ) : (
        <ResourceTable head={['Name', 'Keys', 'Created']}>
          {groups.map((group) => (
            <GroupRow key={group.slug} group={group} />
          ))}
        </ResourceTable>
      )}
    </>
  )
}
