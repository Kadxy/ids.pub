import { envOf, viewerContext } from '~/context'
import { d1Directory } from '~/lib/db.server'
import { isClaimableName, isWellFormedName, normalizeName } from '~/lib/names'
import { keyLines } from '~/lib/public-endpoint'
import type { Route } from './+types/names.check'

export type NameCheck =
  | { name: string; status: 'invalid' | 'reserved' | 'free' | 'gone' }
  | {
      name: string
      status: 'taken' | 'yours'
      /** The account's current name, when `name` is an earlier one. */
      current: string
      /** The first lines curl would print. A private account returns none. */
      lines: string[]
      total: number
      private: boolean
    }

/** Who holds a name, for the live checks on the home, welcome and settings pages. */
export async function loader({ params, context }: Route.LoaderArgs): Promise<NameCheck> {
  const name = normalizeName(params.name)
  if (!isWellFormedName(name)) return { name, status: 'invalid' }
  if (!isClaimableName(name)) return { name, status: 'reserved' }

  const lookup = await d1Directory(envOf(context).DB).lookup(name)
  if (lookup.kind === 'missing') return { name, status: 'free' }
  if (lookup.kind === 'gone') return { name, status: 'gone' }
  const { account } = lookup
  return {
    name,
    status: context.get(viewerContext)?.row.id === account.id ? 'yours' : 'taken',
    current: account.name,
    // What curl gets, which for a private account is nothing.
    lines: account.private ? [] : keyLines(account).split('\n').filter(Boolean).slice(0, 5),
    total: account.private ? 0 : account.keys.length,
    private: account.private,
  }
}
