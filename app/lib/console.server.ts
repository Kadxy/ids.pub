import type { RouterContextProvider } from 'react-router'
import type { ConsoleKey } from '~/components/console/types'
import { accountContext } from '~/context'
import type { Account, StoredKey } from './directory'
import { factsFor } from './key-facts'

/** The signed-in account with its keys and keysets, already read by the middleware. Console routes only. */
export async function signedInAccount(context: Readonly<RouterContextProvider>): Promise<Account> {
  return context.get(accountContext)
}

export function withFacts(keys: StoredKey[]): Promise<ConsoleKey[]> {
  return Promise.all(
    keys.map(async (key) => ({ ...key, facts: await factsFor(key.type, key.base64) })),
  )
}

export const fail = (error: string, status = 400) =>
  Response.json({ ok: false, error } as const, { status })
