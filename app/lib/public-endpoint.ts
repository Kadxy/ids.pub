import { prefersHtml } from './accept'
import { type Account, type Directory, keysIn } from './directory'
import { isWellFormedName, RESERVED_NAMES } from './names'
import { publicUrl, SITE_ORIGIN, signerPrincipal } from './site'
import { authorizedKeysLine, formatFingerprint, parsePublicKey, sha256 } from './ssh-key'

export type Format = 'keys' | 'json' | 'signers'

export interface PublicPath {
  name: string
  keyset?: string
  /** Set when the path ends in `.keys`, `.json` or `.signers`; otherwise the Accept header decides. */
  format?: Format
}

const PUBLIC_PATH = /^\/([A-Za-z0-9-]+)(?:\/([A-Za-z0-9-]+))?(?:\.(keys|json|signers)|\/)?$/

export function matchPublicPath(pathname: string): PublicPath | null {
  const match = PUBLIC_PATH.exec(pathname)
  if (!match) return null
  const name = (match[1] ?? '').toLowerCase()
  const keyset = match[2]?.toLowerCase()
  if (!isWellFormedName(name) || RESERVED_NAMES.has(name)) return null
  if (keyset !== undefined && !isWellFormedName(keyset)) return null
  return { name, keyset, format: match[3] as Format | undefined }
}

/**
 * Plain HTTP, where the site itself is served over HTTPS. Keys are never sent this way: anyone on
 * the path could swap in their own and so get into a server that trusts them. A request for keys
 * gets a line saying where to ask instead, with an error status so `curl -f` and sshd take nothing;
 * a page is sent on to its HTTPS address. Returns null for HTTPS, and for local development.
 */
export function refuseInsecure(request: Request, appOrigin: string): Response | null {
  const url = new URL(request.url)
  if (url.protocol !== 'http:' || !appOrigin.startsWith('https:')) return null
  const secure = new URL(url.pathname + url.search, appOrigin).href
  const path = matchPublicPath(url.pathname)
  const forKeys =
    path !== null &&
    (path.format !== undefined ||
      path.keyset !== undefined ||
      !prefersHtml(request.headers.get('accept')))
  if (forKeys) {
    return new Response(
      request.method === 'HEAD' ? null : `Keys are only served over HTTPS: ${secure}\n`,
      {
        status: 400,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'no-store',
          'x-robots-tag': 'noindex',
        },
      },
    )
  }
  const keepsMethod = request.method !== 'GET' && request.method !== 'HEAD'
  return Response.redirect(secure, keepsMethod ? 308 : 301)
}

/**
 * Answers machine requests for `/<name>` and `/<name>/<keyset>` directly from the Worker, without
 * rendering React. Returns null when the request is for the web page or is not an address at all.
 */
export async function respondWithKeys(
  request: Request,
  directory: Directory,
): Promise<Response | null> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null
  const path = matchPublicPath(new URL(request.url).pathname)
  if (!path) return null

  // Only a person's own address has a page; a group's always answers with keys.
  const negotiated = path.format === undefined && path.keyset === undefined
  if (negotiated && prefersHtml(request.headers.get('accept'))) return null
  const format = path.format ?? 'keys'

  const headers = new Headers({
    'content-type':
      format === 'json' ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'access-control-allow-origin': '*',
    'access-control-expose-headers': 'link',
    // Keys are for the machines that fetch them, not for search results.
    'x-robots-tag': 'noindex',
  })
  if (negotiated) headers.set('vary', 'Accept')

  const reply = (status: number, body: string | null) =>
    new Response(request.method === 'HEAD' ? null : body, { status, headers })
  const errorBody = (error: string) => (format === 'json' ? JSON.stringify({ error }) : null)

  const lookup = await directory.lookup(path.name)
  if (lookup.kind === 'missing') return reply(404, errorBody('not_found'))
  if (lookup.kind === 'gone') return reply(410, errorBody('gone'))

  const { account } = lookup
  // A private account is its owner's tool only: its addresses serve nothing, to anyone.
  if (account.private) return reply(404, errorBody('not_found'))
  if (path.keyset && !account.keysets.some((keyset) => keyset.slug === path.keyset)) {
    return reply(404, errorBody('group_not_found'))
  }

  // Where this address lives now, and what describes how addresses answer.
  headers.set(
    'link',
    `<${publicUrl(account.name, path.keyset)}>; rel="canonical", <${SITE_ORIGIN}/llms.txt>; rel="describedby"`,
  )
  const body =
    format === 'json'
      ? JSON.stringify(await describe(account, path.keyset))
      : format === 'signers'
        ? signerLines(account, path.keyset)
        : keyLines(account, path.keyset)
  return reply(200, body)
}

export function keyLines(account: Account, keyset?: string): string {
  const lines = keysIn(account, keyset).map((key) => authorizedKeysLine(key, key.comment))
  return lines.length ? `${lines.join('\n')}\n` : ''
}

/**
 * The keys as ssh-keygen(1) reads an allowed signers file: each line starts with who signed, so
 * `ssh-keygen -Y verify` and Git can check a signature against them. No namespace is set; the one
 * checking names it.
 */
export function signerLines(account: Account, keyset?: string): string {
  const principal = signerPrincipal(account.name)
  const lines = keysIn(account, keyset).map(
    (key) => `${principal} ${authorizedKeysLine(key, key.comment)}`,
  )
  return lines.length ? `${lines.join('\n')}\n` : ''
}

async function describe(account: Account, keyset?: string) {
  const keys = await Promise.all(
    keysIn(account, keyset).map(async (key) => {
      const parsed = parsePublicKey(`${key.type} ${key.base64}`)
      if (!parsed.ok) throw new Error(`stored key ${key.id} no longer parses: ${parsed.error}`)
      return {
        comment: key.comment,
        type: key.type,
        key: key.base64,
        bits: parsed.key.bits,
        fingerprint: formatFingerprint(await sha256(parsed.key.blob)),
        added: key.addedAt,
      }
    }),
  )
  return { name: account.name, group: keyset ?? null, url: publicUrl(account.name, keyset), keys }
}
