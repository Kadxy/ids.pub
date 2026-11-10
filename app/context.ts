import { createContext, type RouterContextProvider } from 'react-router'
import type { AccountRow } from './lib/db.server'
import type { Account } from './lib/directory'

export const cloudflareContext = createContext<{ env: Env; ctx: ExecutionContext }>()

/** Who is signed in, read once per request by the root middleware. */
export const viewerContext = createContext<{ row: AccountRow; account: Account | null } | null>(
  null,
)

/** The signed-in account, set by the console layout's middleware. Always has a name. */
export const accountContext = createContext<Account>()

export const envOf = (context: Readonly<RouterContextProvider>) =>
  context.get(cloudflareContext).env
