import type { StoredKey } from '~/lib/directory'
import type { KeyFacts } from '~/lib/key-facts'

export type ConsoleKey = StoredKey & { facts: KeyFacts }

/** What console actions return to the fetcher that called them. */
export type ActionResult =
  | { ok: true; intent: string; name?: string }
  | { ok: false; error: string }
