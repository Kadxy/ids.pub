import { describe, expect, test } from 'bun:test'
import { fixtureDirectory } from '../../test/directory-fixture'
import { matchPublicPath, refuseInsecure, respondWithKeys } from './public-endpoint'
import { KEY_TYPES } from './ssh-key'

const BROWSER = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'

function get(path: string, accept: string | null = '*/*', method = 'GET') {
  const headers = accept === null ? undefined : { accept }
  return respondWithKeys(
    new Request(`https://ids.pub${path}`, { method, headers }),
    fixtureDirectory,
  )
}

describe('matchPublicPath', () => {
  test.each([
    ['/mira', { name: 'mira', keyset: undefined, format: undefined }],
    ['/Mira/CI.keys', { name: 'mira', keyset: 'ci', format: 'keys' }],
    ['/mira.json', { name: 'mira', keyset: undefined, format: 'json' }],
    ['/mira/ci.signers', { name: 'mira', keyset: 'ci', format: 'signers' }],
    ['/mira/', { name: 'mira', keyset: undefined, format: undefined }],
  ])('%p', (path, expected) => {
    expect(matchPublicPath(path)).toEqual(expected as never)
  })

  test.each([
    '/',
    '/settings',
    '/mira.data',
    '/-/login',
    '/mira/ci/extra',
    '/al--ice',
    '/favicon.ico',
  ])('leaves %p to the app', (path) => {
    expect(matchPublicPath(path)).toBeNull()
  })
})

describe('respondWithKeys', () => {
  test('curl gets one bare key per line', async () => {
    const response = await get('/mira')
    expect(response?.status).toBe(200)
    expect(response?.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    expect(response?.headers.get('vary')).toBe('Accept')
    // A removed key must stop working at once, so nothing may keep a copy.
    expect(response?.headers.get('cache-control')).toBe('no-store')
    const lines = (await response?.text())?.trimEnd().split('\n') ?? []
    expect(lines).toHaveLength(5)
    for (const line of lines) {
      expect(KEY_TYPES).toContain(line.split(' ')[0] as never)
    }
  })

  test('keys stay out of search results', async () => {
    for (const path of ['/mira', '/mira/ci', '/mira.json', '/mira.signers', '/nobody']) {
      expect((await get(path))?.headers.get('x-robots-tag')).toBe('noindex')
    }
  })

  test('a request without an Accept header is a machine', async () => {
    expect((await get('/mira', null))?.status).toBe(200)
  })

  test('browsers fall through to the web page', async () => {
    expect(await get('/mira', BROWSER)).toBeNull()
  })

  test('a suffix fixes the format whatever the Accept header says', async () => {
    const response = await get('/mira.keys', BROWSER)
    expect(response?.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    expect(response?.headers.has('vary')).toBe(false)
  })

  test('a group answers with keys even to a browser; only a person has a page', async () => {
    const response = await get('/mira/ci', BROWSER)
    expect(response?.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    expect(response?.headers.has('vary')).toBe(false)
  })

  test('a group returns only its own keys', async () => {
    const response = await get('/mira/ci')
    expect(await response?.text()).toBe(
      'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDQsJJpL9YIQAU3dQ3RvB55xFzAIWlgIinuqZ6HpfeH4 deploy-bot\n',
    )
  })

  test('.signers puts who signed before each key, as an allowed signers file', async () => {
    const response = await get('/mira/ci.signers', BROWSER)
    expect(response?.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    expect(await response?.text()).toBe(
      'mira@ids.pub ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDQsJJpL9YIQAU3dQ3RvB55xFzAIWlgIinuqZ6HpfeH4 deploy-bot\n',
    )
  })

  test('signers asked for by an earlier name are signed by the current one', async () => {
    const text = (await (await get('/mira-old.signers'))?.text()) ?? ''
    const lines = text.trimEnd().split('\n')
    expect(lines).toHaveLength(5)
    for (const line of lines) expect(line.startsWith('mira@ids.pub ')).toBe(true)
  })

  test('an earlier name serves the same keys and points at the current one', async () => {
    const [current, earlier] = await Promise.all([get('/mira'), get('/mira-old')])
    expect(await earlier?.text()).toBe((await current?.text()) ?? '')
    expect(earlier?.headers.get('link')).toBe(
      '<https://ids.pub/mira>; rel="canonical", <https://ids.pub/llms.txt>; rel="describedby"',
    )
  })

  test.each([
    ['/nobody', 404],
    ['/mira/nope', 404],
    ['/carol', 410],
  ])('%p answers %p with an empty body', async (path, status) => {
    const response = await get(path)
    expect(response?.status).toBe(status)
    expect(await response?.text()).toBe('')
  })

  test.each(['/dana', '/dana/ci', '/dana.keys', '/dana/ci.json', '/dana.signers'])(
    'a private account serves nothing at %p',
    async (path) => {
      const response = await get(path)
      expect(response?.status).toBe(404)
      expect(response?.headers.has('link')).toBe(false)
    },
  )

  test('JSON carries fingerprints', async () => {
    const response = await get('/mira/ci.json')
    expect(await response?.json()).toEqual({
      name: 'mira',
      group: 'ci',
      url: 'https://ids.pub/mira/ci',
      keys: [
        {
          comment: 'deploy-bot',
          type: 'ssh-ed25519',
          key: 'AAAAC3NzaC1lZDI1NTE5AAAAIDQsJJpL9YIQAU3dQ3RvB55xFzAIWlgIinuqZ6HpfeH4',
          bits: 256,
          fingerprint: 'SHA256:qFNW1dCKxrl+JaJNHDbnTVeD18sEjpM8B24nGzrYX5w',
          added: '2026-08-09T11:00:00Z',
        },
      ],
    })
  })

  test('HEAD has headers and no body', async () => {
    const response = await get('/mira', '*/*', 'HEAD')
    expect(response?.status).toBe(200)
    expect(await response?.text()).toBe('')
  })

  test('other methods are left to the app', async () => {
    expect(await get('/mira', '*/*', 'POST')).toBeNull()
  })
})

describe('refuseInsecure', () => {
  const SITE = 'https://ids.pub'
  const over = (url: string, accept: string | null = '*/*', method = 'GET') =>
    refuseInsecure(
      new Request(url, { method, headers: accept === null ? undefined : { accept } }),
      SITE,
    )

  test.each([
    'http://ids.pub/mira',
    'http://ids.pub/mira.keys',
    'http://ids.pub/mira/ci',
    'http://ids.pub/mira.signers',
  ])('%p never sends keys, and says where to ask', async (url) => {
    const response = over(url)
    expect(response?.status).toBe(400)
    const text = (await response?.text()) ?? ''
    expect(text).toBe(`Keys are only served over HTTPS: ${url.replace('http:', 'https:')}\n`)
  })

  test('a browser asking for a page over HTTP is sent to HTTPS', () => {
    const response = over('http://ids.pub/mira?x=1', BROWSER)
    expect(response?.status).toBe(301)
    expect(response?.headers.get('location')).toBe('https://ids.pub/mira?x=1')
  })

  test('a form posted over HTTP keeps its method on the way to HTTPS', () => {
    expect(over('http://ids.pub/settings', BROWSER, 'POST')?.status).toBe(308)
  })

  test('HTTPS, and local development over HTTP, pass through', () => {
    expect(over('https://ids.pub/mira')).toBeNull()
    expect(
      refuseInsecure(new Request('http://localhost:3201/mira'), 'http://localhost:3201'),
    ).toBeNull()
  })
})
