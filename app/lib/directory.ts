import type { KeyType } from './ssh-key'

/** What the public endpoints and pages need to know about an account. */
export interface StoredKey {
  id: string
  type: KeyType
  base64: string
  /** What the owner calls the key, in the console and on the public page. May be empty; see keyTitle. */
  name: string
  /** Follows the key in its line, as in authorized_keys. */
  comment: string
  /** Private: only the owner sees it. */
  note: string
  addedAt: string
  keysets: string[]
  /** The key's picture: a glyph, picked by the owner or guessed from the key. */
  icon: KeyIcon
}

/** Glyphs from Lucide, for what a key unlocks or where it lives. Two rows of ten in the picker. */
export const KEY_ICONS = [
  'key',
  'laptop',
  'desktop',
  'phone',
  'router',
  'security-key',
  'server',
  'cloud',
  'container',
  'database',
  'terminal',
  'bot',
  'git',
  'briefcase',
  'home',
  'building',
  'rocket',
  'shield',
  'globe',
  'flask',
] as const
export type KeyIcon = (typeof KEY_ICONS)[number]
export const isKeyIcon = (value: unknown): value is KeyIcon =>
  (KEY_ICONS as readonly unknown[]).includes(value)

/** Words in a comment that say what a key is for, first match wins. */
const ICON_HINTS: [RegExp, KeyIcon][] = [
  [/yubi|fido|solokey|titan|nitrokey|security.?key/i, 'security-key'],
  [/laptop|macbook|\bmbp\b|\bmba\b|thinkpad|\bxps\b|notebook|framework/i, 'laptop'],
  [/iphone|android|phone|pixel|termius|blink/i, 'phone'],
  [/router|openwrt|\bnas\b|synology|raspberry|\bpi\b/i, 'router'],
  [/desktop|imac|workstation|mac.?mini|mac.?studio|\bpc\b/i, 'desktop'],
  [/github|gitlab|gitea|bitbucket|\bgit\b/i, 'git'],
  [/deploy|\bci\b|\bcd\b|\bbot\b|actions|jenkins|runner|automation/i, 'bot'],
  [/docker|container|k8s|kube/i, 'container'],
  [/\baws\b|\bgcp\b|azure|cloud|\bec2\b/i, 'cloud'],
  [/server|\bvps\b|\bprod|staging|\bhost\b/i, 'server'],
  [/\bwork\b|office|corp/i, 'briefcase'],
  [/\bhome\b/i, 'home'],
]

/** A glyph for a new key, guessed from its comment and type. */
export function guessIcon(key: { type: string; comment: string }): KeyIcon {
  if (key.type.startsWith('sk-')) return 'security-key'
  return ICON_HINTS.find(([pattern]) => pattern.test(key.comment))?.[1] ?? 'key'
}

/** What a key is called: its name, else its comment, else its algorithm. */
export const keyTitle = (key: { name: string; comment: string }, algorithm: string) =>
  key.name.trim() || key.comment.trim() || `${algorithm} key`

/**
 * Limits that keep every page and response a sensible size. A key's name is a short label, and a
 * note a sentence or two.
 */
export const LIMITS = { keys: 100, keysets: 50, keyName: 50, note: 200 } as const

/** A note: one line of plain text. Its length is checked, not cut, so nothing is lost silently. */
export function cleanNote(raw: string): string {
  return raw
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** A key's name: one line of plain text, cut to LIMITS.keyName characters. */
export function cleanKeyName(raw: string): string {
  const cleaned = raw
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return Array.from(cleaned).slice(0, LIMITS.keyName).join('').trim()
}

/**
 * A named subset of an account's keys with its own address. People see it called a group, in the
 * interface and in public output; the code and the database keep the word keyset. Groups are never
 * listed anywhere public: only someone who knows the address gets its keys.
 */
export interface Keyset {
  slug: string
  createdAt: string
  /** Private: only the owner sees it. */
  note: string
}

export type NameStatus = 'current' | 'active' | 'retired'

export interface HeldName {
  name: string
  status: NameStatus
  since: string
}

export interface Account {
  id: string
  name: string
  names: HeldName[]
  /** When the account changed its username, oldest first. */
  renames: string[]
  github: { id: number; login: string; twoFactor: boolean }
  keys: StoredKey[]
  keysets: Keyset[]
  /** People see only that the name is taken. Machines still get the keys. */
  private: boolean
  updatedAt: string
}

export type Lookup =
  | { kind: 'found'; account: Account; requested: string }
  | { kind: 'gone'; requested: string }
  | { kind: 'missing'; requested: string }

export interface Directory {
  lookup(name: string): Promise<Lookup>
}

/** A key's page. */
export const keyPath = (id: string) => `/keys/${id}`

export function keysIn(account: Account, keyset?: string): StoredKey[] {
  return keyset ? account.keys.filter((key) => key.keysets.includes(keyset)) : account.keys
}
