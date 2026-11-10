/**
 * Name rules. They mirror GitHub logins so a GitHub login is always a valid default, minus the
 * dot, which the `.keys` and `.json` suffixes need.
 */

export const NAME_MAX_LENGTH = 39
/**
 * An account may change its username twice in any thirty days, and five times in all. Going back
 * to an earlier name is a change too; claiming the first name is not. Since names are never
 * released, this also caps how many an account can hold.
 */
export const RENAMES_PER_WINDOW = 2
export const RENAME_WINDOW_DAYS = 30
export const RENAME_LIMIT = 5
export const KEYSET_SLUG_MAX_LENGTH = 32
const NAME_PATTERN = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/

/**
 * Top-level paths that can never be names. New top-level pages may only use a word from this
 * list; everything else lives under `/-/`, which no name can collide with.
 */
export const RESERVED_NAMES: ReadonlySet<string> = new Set([
  'about',
  'account',
  'admin',
  // The home page's example person, as in cryptography's Alice and Bob: it is no one's.
  'alice',
  'api',
  'assets',
  'auth',
  'blog',
  'cli',
  'dashboard',
  'docs',
  'download',
  // Like example.com, an address that never belongs to anyone.
  'example',
  'help',
  'ids',
  'install',
  'sh',
  'keys',
  'keysets',
  'groups',
  'guide',
  'log',
  'login',
  'logout',
  'map',
  'new',
  'privacy',
  'root',
  'security',
  'settings',
  'signin',
  'signup',
  'static',
  'status',
  'support',
  'terms',
  'welcome',
  'www',
])

export function normalizeName(raw: string): string {
  return raw.trim().toLowerCase()
}

export function isWellFormedName(name: string): boolean {
  return NAME_PATTERN.test(name)
}

export function isClaimableName(name: string): boolean {
  return isWellFormedName(name) && !RESERVED_NAMES.has(name)
}

export const unavailable = (name: string) =>
  `Username ${name} is not available. Please choose another.`

/** Why a name can't be an account's name, judged without asking who holds it; or null. */
export function nameProblem(name: string): string | null {
  if (name === '') return 'Choose a username.'
  if (!isWellFormedName(name))
    return `Use lowercase letters, digits and single hyphens, up to ${NAME_MAX_LENGTH} characters.`
  if (!isClaimableName(name)) return unavailable(name)
  return null
}

/** Why a group name can't be used, or null. Group names follow the same rules as account names. */
export function keysetSlugProblem(raw: string, existing: string[]): string | null {
  const slug = normalizeName(raw)
  if (slug === '') return 'Give the group a name.'
  if (slug.length > KEYSET_SLUG_MAX_LENGTH)
    return `Keep it to ${KEYSET_SLUG_MAX_LENGTH} characters or fewer.`
  if (!isWellFormedName(slug)) return 'Use lowercase letters, digits and single hyphens.'
  if (existing.includes(slug)) return `You already have a group called ${slug}.`
  return null
}
