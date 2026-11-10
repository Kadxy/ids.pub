import { describe, expect, test } from 'bun:test'
import { testD1 } from '../../test/d1'
import {
  currentAccount,
  endSession,
  finishGitHubSignIn,
  isSameOrigin,
  readCookie,
  startGitHubSignIn,
  startSession,
} from './auth.server'
import { upsertGitHubAccount } from './db.server'

const env = () => ({
  APP_ORIGIN: 'https://ids.pub',
  GITHUB_CLIENT_ID: 'client',
  GITHUB_CLIENT_SECRET: 'secret',
  DB: testD1(),
})

/** A fake GitHub that records what it was asked. */
function fakeGitHub(user: object = { id: 42, login: 'Alice', two_factor_authentication: true }) {
  const calls: { url: string; method: string; body?: string }[] = []
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, method: init?.method ?? 'GET', body: init?.body as string | undefined })
    if (url.endsWith('/login/oauth/access_token'))
      return Response.json({ access_token: 'gho_token' })
    if (url.endsWith('/user')) return Response.json(user)
    return new Response(null, { status: 204 })
  }) as typeof fetch
  return { fetcher, calls }
}

async function begin(e = env()) {
  const response = await startGitHubSignIn(e)
  const location = new URL(response.headers.get('location') ?? '')
  const setCookie = response.headers.get('set-cookie') ?? ''
  const oauthCookie = setCookie.split(';')[0] ?? ''
  return { e, location, setCookie, oauthCookie }
}

describe('GitHub sign-in', () => {
  test('sends the browser to GitHub with state, PKCE and the fixed callback', async () => {
    const { location, setCookie } = await begin()
    expect(location.origin + location.pathname).toBe('https://github.com/login/oauth/authorize')
    expect(location.searchParams.get('redirect_uri')).toBe('https://ids.pub/auth/github/callback')
    expect(location.searchParams.get('code_challenge_method')).toBe('S256')
    expect(location.searchParams.get('scope')).toBe('read:user')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('Secure')
  })

  test('reads the user, then revokes the token', async () => {
    const { e, location, oauthCookie } = await begin()
    const github = fakeGitHub()
    const callback = new Request(
      `https://ids.pub/auth/github/callback?code=abc&state=${location.searchParams.get('state')}`,
      { headers: { cookie: oauthCookie } },
    )
    const { user } = await finishGitHubSignIn(callback, e, github.fetcher)
    expect(user).toEqual({ id: 42, login: 'Alice', twoFactor: true })

    const exchange = JSON.parse(github.calls[0]?.body ?? '{}')
    expect(exchange.code_verifier?.length).toBeGreaterThan(43)
    expect(github.calls.at(-1)).toMatchObject({
      method: 'DELETE',
      url: 'https://api.github.com/applications/client/token',
    })
  })

  test('rejects a callback whose state does not match the cookie', async () => {
    const { e, oauthCookie } = await begin()
    const callback = new Request('https://ids.pub/auth/github/callback?code=abc&state=forged', {
      headers: { cookie: oauthCookie },
    })
    await expect(finishGitHubSignIn(callback, e, fakeGitHub().fetcher)).rejects.toBe('expired')
  })

  test('reports a cancelled authorization as denied', async () => {
    const callback = new Request('https://ids.pub/auth/github/callback?error=access_denied')
    await expect(finishGitHubSignIn(callback, env(), fakeGitHub().fetcher)).rejects.toBe('denied')
  })

  test('treats a missing 2FA field as unknown, not as off', async () => {
    const { e, location, oauthCookie } = await begin()
    const callback = new Request(
      `https://ids.pub/auth/github/callback?code=abc&state=${location.searchParams.get('state')}`,
      { headers: { cookie: oauthCookie } },
    )
    const { user } = await finishGitHubSignIn(
      callback,
      e,
      fakeGitHub({ id: 42, login: 'alice' }).fetcher,
    )
    expect(user.twoFactor).toBeNull()
  })
})

describe('sessions', () => {
  test('a session cookie finds its account until the session ends', async () => {
    const e = env()
    const account = await upsertGitHubAccount(e.DB, { id: 1, login: 'alice', twoFactor: true })
    const setCookie = await startSession(e, account.id)
    expect(setCookie).toStartWith('__Host-ids_session=')
    const request = new Request('https://ids.pub/keys', {
      headers: { cookie: setCookie.split(';')[0] ?? '' },
    })

    expect((await currentAccount(request, e))?.id).toBe(account.id)
    const token = readCookie(request, '__Host-ids_session') ?? ''
    const stored = await e.DB.prepare('SELECT id FROM sessions').first<string>('id')
    expect(stored).not.toBe(token)

    expect(await endSession(request, e)).toContain('Max-Age=0')
    expect(await currentAccount(request, e)).toBeNull()
  })

  test('only same-origin requests may change anything', () => {
    const post = (origin?: string) =>
      new Request('https://ids.pub/keys', { method: 'POST', headers: origin ? { origin } : {} })
    expect(isSameOrigin(post('https://ids.pub'), env())).toBe(true)
    expect(isSameOrigin(post('https://evil.example'), env())).toBe(false)
    expect(isSameOrigin(post(), env())).toBe(false)
  })
})
