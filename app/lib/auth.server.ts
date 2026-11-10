import { deleteSession, findSessionAccount, insertSession, loadSessionAccount } from './db.server'

/**
 * GitHub sign-in and sessions.
 *
 * - The redirect URI and cookies are built from APP_ORIGIN, never from the request's Host.
 * - The OAuth flow uses state and PKCE (S256), both kept in a short-lived HttpOnly cookie.
 * - The GitHub token is used once to read the user and then revoked. Nothing of it is stored.
 * - Sessions are random tokens in an HttpOnly cookie; D1 keeps only their SHA-256.
 */

export const SESSION_DAYS = 7
export const HIDE_2FA_COOKIE = 'ids_hide_2fa'
const OAUTH_COOKIE = 'ids_oauth'
const GITHUB_SCOPE = 'read:user'
const USER_AGENT = 'ids.pub'

type AuthEnv = Pick<Env, 'APP_ORIGIN' | 'GITHUB_CLIENT_ID' | 'GITHUB_CLIENT_SECRET' | 'DB'>

const isSecure = (env: Pick<Env, 'APP_ORIGIN'>) => env.APP_ORIGIN.startsWith('https://')
/** `__Host-` pins the cookie to this exact origin, but browsers only accept it over HTTPS. */
const sessionCookieName = (env: Pick<Env, 'APP_ORIGIN'>) =>
  isSecure(env) ? '__Host-ids_session' : 'ids_session'
export const callbackUrl = (env: Pick<Env, 'APP_ORIGIN'>) =>
  `${env.APP_ORIGIN}/auth/github/callback`

function cookie(
  env: Pick<Env, 'APP_ORIGIN'>,
  name: string,
  value: string,
  maxAge: number,
  path = '/',
) {
  return [
    `${name}=${value}`,
    `Path=${path}`,
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'SameSite=Lax',
    ...(isSecure(env) ? ['Secure'] : []),
  ].join('; ')
}

/** A name someone picked before signing in, carried through GitHub to the welcome page. */
export const WANTED_NAME_COOKIE = 'ids_wanted_name'
export const wantedNameCookie = (env: Pick<Env, 'APP_ORIGIN'>, name: string | null) =>
  cookie(env, WANTED_NAME_COOKIE, name ?? '', name ? 1800 : 0)

export function readCookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return rest.join('=')
  }
  return null
}

function randomToken(bytes = 32): string {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)))
}

function base64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

async function sha256Hex(text: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)),
  )
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

// ---------------------------------------------------------------- OAuth

/** Starts sign-in: remembers state and the PKCE verifier, then sends the browser to GitHub. */
export async function startGitHubSignIn(env: AuthEnv): Promise<Response> {
  const state = randomToken()
  const verifier = randomToken(48)
  const challenge = base64url(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))),
  )
  const url = new URL('https://github.com/login/oauth/authorize')
  url.search = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: callbackUrl(env),
    scope: GITHUB_SCOPE,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString()
  return new Response(null, {
    status: 302,
    headers: {
      location: url.toString(),
      'set-cookie': cookie(env, OAUTH_COOKIE, `${state}.${verifier}`, 600, '/auth/github'),
      'cache-control': 'no-store',
    },
  })
}

export type SignInFailure = 'denied' | 'expired' | 'github'

export interface GitHubUser {
  id: number
  login: string
  twoFactor: boolean | null
}

/** Finishes sign-in. Throws a SignInFailure string when the attempt can't be trusted or completed. */
export async function finishGitHubSignIn(
  request: Request,
  env: AuthEnv,
  fetcher: typeof fetch = fetch,
): Promise<{ user: GitHubUser; clearOAuthCookie: string }> {
  const url = new URL(request.url)
  const clearOAuthCookie = cookie(env, OAUTH_COOKIE, '', 0, '/auth/github')
  if (url.searchParams.get('error') === 'access_denied') throw 'denied' satisfies SignInFailure

  const [state, verifier] = (readCookie(request, OAUTH_COOKIE) ?? '').split('.')
  const code = url.searchParams.get('code')
  if (!state || !verifier || !code || url.searchParams.get('state') !== state) {
    throw 'expired' satisfies SignInFailure
  }

  const tokenResponse = await fetcher('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'user-agent': USER_AGENT,
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: callbackUrl(env),
      code_verifier: verifier,
    }),
  })
  const token = ((await tokenResponse.json().catch(() => ({}))) as { access_token?: string })
    .access_token
  if (!tokenResponse.ok || !token) throw 'github' satisfies SignInFailure

  try {
    const userResponse = await fetcher('https://api.github.com/user', {
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'user-agent': USER_AGENT,
        'x-github-api-version': '2022-11-28',
      },
    })
    if (!userResponse.ok) throw 'github' satisfies SignInFailure
    const body = (await userResponse.json()) as {
      id?: number
      login?: string
      two_factor_authentication?: boolean
    }
    if (typeof body.id !== 'number' || typeof body.login !== 'string')
      throw 'github' satisfies SignInFailure
    const twoFactor =
      typeof body.two_factor_authentication === 'boolean' ? body.two_factor_authentication : null
    return { user: { id: body.id, login: body.login, twoFactor }, clearOAuthCookie }
  } finally {
    await revokeToken(env, token, fetcher)
  }
}

/** Revokes the GitHub token as soon as it has been used. Best effort: sign-in doesn't depend on it. */
async function revokeToken(env: AuthEnv, token: string, fetcher: typeof fetch) {
  try {
    await fetcher(`https://api.github.com/applications/${env.GITHUB_CLIENT_ID}/token`, {
      method: 'DELETE',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Basic ${btoa(`${env.GITHUB_CLIENT_ID}:${env.GITHUB_CLIENT_SECRET}`)}`,
        'user-agent': USER_AGENT,
        'x-github-api-version': '2022-11-28',
      },
      body: JSON.stringify({ access_token: token }),
    })
  } catch {
    // The token expires on its own; failing to revoke it early isn't worth failing sign-in for.
  }
}

// ---------------------------------------------------------------- sessions

export async function startSession(env: AuthEnv, accountId: string): Promise<string> {
  const token = randomToken()
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000)
  await insertSession(env.DB, await sha256Hex(token), accountId, expires.toISOString())
  return cookie(env, sessionCookieName(env), token, SESSION_DAYS * 86_400)
}

/** The signed-in account and all its data, in one query. Null without a valid session. */
export async function currentSession(request: Request, env: AuthEnv) {
  const token = readCookie(request, sessionCookieName(env))
  if (!token) return null
  return loadSessionAccount(env.DB, await sha256Hex(token))
}

export async function currentAccount(request: Request, env: AuthEnv) {
  const token = readCookie(request, sessionCookieName(env))
  if (!token) return null
  return findSessionAccount(env.DB, await sha256Hex(token))
}

export async function endSession(request: Request, env: AuthEnv): Promise<string> {
  const token = readCookie(request, sessionCookieName(env))
  if (token) await deleteSession(env.DB, await sha256Hex(token))
  return cookie(env, sessionCookieName(env), '', 0)
}

/** Changes must come from our own pages. SameSite=Lax already blocks most cross-site posts. */
export function isSameOrigin(request: Request, env: Pick<Env, 'APP_ORIGIN'>): boolean {
  return request.headers.get('origin') === env.APP_ORIGIN
}
