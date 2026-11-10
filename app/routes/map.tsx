import { KeyRoundIcon } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { KeyFan } from '~/components/key-fan'
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
import { signedInAccount, withFacts } from '~/lib/console.server'
import { keyPath, keysIn, keyTitle } from '~/lib/directory'
import { cachedLoader } from '~/lib/page-cache'
import { addressPath } from '~/lib/site'
import type { Route } from './+types/map'

export const meta: Route.MetaFunction = () => [{ title: 'Map – ids.pub' }]

export async function loader({ context }: Route.LoaderArgs) {
  const account = await signedInAccount(context)
  const keys = await withFacts(account.keys)
  return {
    name: account.name,
    keys: keys.map((key) => ({
      id: key.id,
      name: keyTitle(key, key.facts.algorithm),
      icon: key.icon,
      type: key.facts.algorithm,
    })),
    groups: account.keysets.map((keyset) => ({
      slug: keyset.slug,
      keys: keysIn(account, keyset.slug).map((key) => key.id),
    })),
  }
}

/** Back on this page, show it as it was and refresh it quietly; see ~/lib/page-cache. */
export const clientLoader = (args: Route.ClientLoaderArgs) => cachedLoader(args)

/**
 * The home page's drawing, with the signed-in person's own keys and groups: their address over
 * every key, each group under the keys it has. Each box opens its page: the address the public
 * page, a key or a group its own.
 */
export default function KeyMap({ loaderData }: Route.ComponentProps) {
  const { name } = loaderData
  // Ids that can't collide: a group could be named like a key's id.
  const { address, keys, groups } = useMemo(
    () => ({
      address: { id: 'address', name, to: addressPath(name) },
      keys: loaderData.keys.map((key) => ({ ...key, id: `key:${key.id}`, to: keyPath(key.id) })),
      groups: loaderData.groups.map((group) => ({
        id: `group:${group.slug}`,
        name: group.slug,
        keys: group.keys.map((id) => `key:${id}`),
        to: `/groups/${group.slug}`,
      })),
    }),
    [name, loaderData.keys, loaderData.groups],
  )

  return (
    <>
      <PageHeader title="Map" />
      {keys.length === 0 ? (
        <Empty className="rounded-xl border border-dashed py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <KeyRoundIcon />
            </EmptyMedia>
            <EmptyTitle>No keys yet</EmptyTitle>
            <EmptyDescription>
              Once you add keys, they show here with their groups.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link to="/keys">Go to Keys</Link>
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="mt-10 select-none">
          <KeyFan address={address} keys={keys} groups={groups} wrap />
        </div>
      )}
    </>
  )
}
