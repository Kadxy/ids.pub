import { beforeEach, describe, expect, test } from 'bun:test'
import { testD1 } from '../../test/d1'
import {
  addKeys,
  changeName,
  claimFirstName,
  createKeyset,
  d1Directory,
  deleteAccount,
  deleteKeyset,
  insertSession,
  loadAccount,
  loadSessionAccount,
  removeKey,
  saveKeyset,
  setEarlierName,
  setPrivate,
  updateKey,
  upsertGitHubAccount,
} from './db.server'

const LAPTOP = {
  type: 'ssh-ed25519' as const,
  base64: 'AAAAC3NzaC1lZDI1NTE5AAAAIJ6RNhWCGts+o9e+sMtLB6jRwd3yLF2c4d+tDN+1HbQl',
  name: 'Laptop',
  comment: 'alice@laptop',
  note: '',
  icon: 'laptop' as const,
}
const DEPLOY = {
  type: 'ssh-ed25519' as const,
  base64: 'AAAAC3NzaC1lZDI1NTE5AAAAIDQsJJpL9YIQAU3dQ3RvB55xFzAIWlgIinuqZ6HpfeH4',
  name: '',
  comment: '',
  note: '',
  icon: 'bot' as const,
}

let db: D1Database
beforeEach(() => {
  db = testD1()
})

async function signUp(githubId: number, login: string, name: string) {
  const account = await upsertGitHubAccount(db, { id: githubId, login, twoFactor: true })
  expect(await claimFirstName(db, account.id, name)).toBe('claimed')
  return account.id
}

describe('accounts', () => {
  test('signing in again keeps the same account and refreshes the GitHub snapshot', async () => {
    const first = await upsertGitHubAccount(db, { id: 1, login: 'alice', twoFactor: false })
    const again = await upsertGitHubAccount(db, { id: 1, login: 'alice-renamed', twoFactor: true })
    expect(again.id).toBe(first.id)
    expect(again.github_login).toBe('alice-renamed')
    expect(again.github_two_factor).toBe(1)
  })

  test('a name can be claimed once, ever', async () => {
    await signUp(1, 'alice', 'alice')
    const bob = await upsertGitHubAccount(db, { id: 2, login: 'bob', twoFactor: true })
    expect(await claimFirstName(db, bob.id, 'alice')).toBe('taken')
    expect((await loadAccount(db, bob.id)) === null).toBe(true)
  })

  test('an account only gets a first name once', async () => {
    const aliceId = await signUp(1, 'alice', 'alice')
    expect(await claimFirstName(db, aliceId, 'alice2')).toBe('taken')
    expect((await loadAccount(db, aliceId))?.name).toBe('alice')
  })

  test('a deleted account leaves its names behind as 410s', async () => {
    const aliceId = await signUp(1, 'alice', 'alice')
    await db.batch([
      db.prepare(`UPDATE names SET status = 'tombstone' WHERE account_id = ?`).bind(aliceId),
      db.prepare('DELETE FROM accounts WHERE id = ?').bind(aliceId),
    ])
    expect((await d1Directory(db).lookup('alice')).kind).toBe('gone')
    const carol = await upsertGitHubAccount(db, { id: 3, login: 'carol', twoFactor: true })
    expect(await claimFirstName(db, carol.id, 'alice')).toBe('taken')
  })
})

describe('changing names', () => {
  /** Moves the account's past back by this many days: its name changes, and when it took each name. */
  async function age(accountId: string, days: number) {
    for (const [table, column] of [
      ['name_changes', 'changed_at'],
      ['names', 'claimed_at'],
    ]) {
      const rows = await db
        .prepare(`SELECT rowid AS id, ${column} AS at FROM ${table} WHERE account_id = ?`)
        .bind(accountId)
        .all<{ id: number; at: string }>()
      for (const row of rows.results) {
        const at = new Date(new Date(row.at).getTime() - days * 86_400_000).toISOString()
        await db.prepare(`UPDATE ${table} SET ${column} = ? WHERE rowid = ?`).bind(at, row.id).run()
      }
    }
  }
  // Sorted by name: aging rewrites claimed_at, which is what the account's list is ordered by.
  const statuses = async (accountId: string) =>
    (await loadAccount(db, accountId))?.names
      .map((entry) => [entry.name, entry.status])
      .sort(([a], [b]) => String(a).localeCompare(String(b)))

  test('two changes in thirty days, then wait for the older one to age out', async () => {
    const aliceId = await signUp(1, 'alice', 'alice')
    expect(await changeName(db, aliceId, 'alice-2')).toBe('changed')
    expect(await changeName(db, aliceId, 'alice-3')).toBe('changed')
    expect(await changeName(db, aliceId, 'alice-4')).toBe('refused')
    await age(aliceId, 31)
    expect(await changeName(db, aliceId, 'alice-4')).toBe('changed')
    expect((await loadAccount(db, aliceId))?.name).toBe('alice-4')
    expect((await loadAccount(db, aliceId))?.renames).toHaveLength(3)
    expect(await statuses(aliceId)).toEqual([
      ['alice', 'active'],
      ['alice-2', 'active'],
      ['alice-3', 'active'],
      ['alice-4', 'current'],
    ])
  })

  test('the earlier name keeps serving the same keys until it is retired', async () => {
    const aliceId = await signUp(1, 'alice', 'alice')
    await changeName(db, aliceId, 'alice-2')
    const directory = d1Directory(db)
    const earlier = await directory.lookup('alice')
    expect(earlier.kind === 'found' && earlier.account.name).toBe('alice-2')

    await setEarlierName(db, aliceId, 'alice', false)
    expect((await directory.lookup('alice')).kind).toBe('gone')
    await setEarlierName(db, aliceId, 'alice-2', false)
    await setPrivate(db, aliceId, true)
    const account = await loadAccount(db, aliceId)
    expect([account?.name, account?.private]).toEqual(['alice-2', true])
  })

  test('a name held by anyone else, or retired with a deleted account, is taken', async () => {
    const aliceId = await signUp(1, 'alice', 'alice')
    await signUp(2, 'bob', 'bob')
    expect(await changeName(db, aliceId, 'bob')).toBe('taken')
    expect((await loadAccount(db, aliceId))?.name).toBe('alice')
  })

  test('moving back to an earlier name is a change, and needs no new name', async () => {
    const aliceId = await signUp(1, 'alice', 'alice')
    await changeName(db, aliceId, 'alice-2')
    await setEarlierName(db, aliceId, 'alice', false)
    expect(await changeName(db, aliceId, 'alice')).toBe('changed')
    expect((await loadAccount(db, aliceId))?.renames).toHaveLength(2)
    expect(await statuses(aliceId)).toEqual([
      ['alice', 'current'],
      ['alice-2', 'active'],
    ])
  })

  test('an account changes its username at most five times', async () => {
    const aliceId = await signUp(1, 'alice', 'alice')
    for (let n = 2; n <= 6; n++) {
      await age(aliceId, 31)
      expect(await changeName(db, aliceId, `alice-${n}`)).toBe('changed')
    }
    await age(aliceId, 31)
    expect(await changeName(db, aliceId, 'alice-7')).toBe('refused')
    expect(await changeName(db, aliceId, 'alice-3')).toBe('refused')
    expect((await loadAccount(db, aliceId))?.name).toBe('alice-6')
  })

  test('deleting an account needs its exact name, and leaves tombstones behind', async () => {
    const aliceId = await signUp(1, 'alice', 'alice')
    await changeName(db, aliceId, 'alice-2')
    await addKeys(db, aliceId, [LAPTOP])
    expect(await deleteAccount(db, aliceId, 'alice')).toBe(false)
    expect(await deleteAccount(db, aliceId, 'ALICE-2')).toBe(false)
    expect(await loadAccount(db, aliceId)).not.toBeNull()

    expect(await deleteAccount(db, aliceId, 'alice-2')).toBe(true)
    expect(await loadAccount(db, aliceId)).toBeNull()
    expect((await d1Directory(db).lookup('alice')).kind).toBe('gone')
    expect((await d1Directory(db).lookup('alice-2')).kind).toBe('gone')
    expect(await db.prepare('SELECT COUNT(*) AS n FROM keys').first('n')).toBe(0)
  })
})

/** Puts exactly these keys in a keyset, keeping everything else about it. */
async function setMembers(accountId: string, slug: string, keyIds: string[]) {
  return saveKeyset(db, accountId, slug, { slug, note: '', keyIds })
}

describe('keys and keysets', () => {
  test('the directory serves an account by name with its keys and keysets', async () => {
    const aliceId = await signUp(1, 'alice', 'alice')
    await addKeys(db, aliceId, [LAPTOP, DEPLOY])
    await createKeyset(db, aliceId, 'ci')
    const deploy = (await loadAccount(db, aliceId))?.keys.find((key) => key.comment === '')
    await setMembers(aliceId, 'ci', [deploy?.id ?? ''])

    const lookup = await d1Directory(db).lookup('alice')
    if (lookup.kind !== 'found') throw new Error(lookup.kind)
    expect(lookup.account.keys.map((key) => [key.comment, key.keysets])).toEqual([
      ['alice@laptop', []],
      ['', ['ci']],
    ])
    expect((await d1Directory(db).lookup('nobody')).kind).toBe('missing')
  })

  test('the same key can be added once per account, whatever its comment', async () => {
    const aliceId = await signUp(1, 'alice', 'alice')
    await addKeys(db, aliceId, [LAPTOP])
    expect(await addKeys(db, aliceId, [{ ...LAPTOP, comment: 'again' }])).toBe('duplicate')
    expect(await addKeys(db, aliceId, [{ ...DEPLOY, comment: 'alice@laptop' }])).toBe('added')
    expect((await loadAccount(db, aliceId))?.keys).toHaveLength(2)
  })

  test('one account cannot touch or borrow another account’s keys', async () => {
    const aliceId = await signUp(1, 'alice', 'alice')
    const bobId = await signUp(2, 'bob', 'bob')
    await addKeys(db, aliceId, [LAPTOP])
    const aliceKey = (await loadAccount(db, aliceId))?.keys[0]?.id ?? ''

    await removeKey(db, bobId, aliceKey)
    expect((await loadAccount(db, aliceId))?.keys).toHaveLength(1)

    await createKeyset(db, bobId, 'ci')
    await setMembers(bobId, 'ci', [aliceKey])
    expect((await loadAccount(db, bobId))?.keys).toHaveLength(0)
    const members = await db.prepare('SELECT COUNT(*) AS n FROM keyset_keys').first<number>('n')
    expect(members).toBe(0)
  })

  test('removing a key or a keyset removes the membership too', async () => {
    const aliceId = await signUp(1, 'alice', 'alice')
    await addKeys(db, aliceId, [LAPTOP, DEPLOY])
    await createKeyset(db, aliceId, 'admin')
    const keys = (await loadAccount(db, aliceId))?.keys ?? []
    await setMembers(
      aliceId,
      'admin',
      keys.map((key) => key.id),
    )

    await removeKey(db, aliceId, keys[0]?.id ?? '')
    expect((await loadAccount(db, aliceId))?.keys.map((key) => key.keysets)).toEqual([['admin']])

    await deleteKeyset(db, aliceId, 'admin')
    expect((await loadAccount(db, aliceId))?.keys.map((key) => key.keysets)).toEqual([[]])
  })
})

describe('keyset settings', () => {
  async function setup() {
    const aliceId = await signUp(1, 'alice', 'alice')
    await addKeys(db, aliceId, [LAPTOP, DEPLOY])
    await createKeyset(db, aliceId, 'admin')
    await createKeyset(db, aliceId, 'ci')
    const keys = (await loadAccount(db, aliceId))?.keys ?? []
    return { aliceId, laptop: keys[0]?.id ?? '', deploy: keys[1]?.id ?? '' }
  }

  test('a keyset holds exactly the keys it was given, never another account’s', async () => {
    const { aliceId, laptop, deploy } = await setup()
    await setMembers(aliceId, 'admin', [laptop, deploy, 'not-mine'])
    expect((await loadAccount(db, aliceId))?.keys.map((key) => key.keysets)).toEqual([
      ['admin'],
      ['admin'],
    ])
    await setMembers(aliceId, 'admin', [deploy])
    expect((await loadAccount(db, aliceId))?.keys.map((key) => key.keysets)).toEqual([
      [],
      ['admin'],
    ])
  })

  test('only the fields given change', async () => {
    const { aliceId, laptop } = await setup()
    await updateKey(db, aliceId, laptop, { name: 'Work laptop' })
    await updateKey(db, aliceId, laptop, { note: 'the one with the sticker' })
    expect((await loadAccount(db, aliceId))?.keys[0]).toMatchObject({
      name: 'Work laptop',
      comment: 'alice@laptop',
      note: 'the one with the sticker',
      icon: 'laptop',
    })
  })

  test('a keyset is saved whole: keys, note and a new slug together', async () => {
    const { aliceId, laptop, deploy } = await setup()
    const changes = { slug: 'ops', note: 'on call', keyIds: [laptop, deploy] }
    expect(await saveKeyset(db, aliceId, 'admin', changes)).toBe('saved')
    const account = await loadAccount(db, aliceId)
    expect(account?.keysets[0]).toMatchObject({ slug: 'ops', note: 'on call' })
    expect(account?.keys.map((key) => key.keysets)).toEqual([['ops'], ['ops']])
  })

  test('a slug that is taken undoes the whole save', async () => {
    const { aliceId, laptop } = await setup()
    const changes = { slug: 'ci', note: 'lost', keyIds: [laptop] }
    expect(await saveKeyset(db, aliceId, 'admin', changes)).toBe('taken')
    const account = await loadAccount(db, aliceId)
    expect(account?.keysets.map((keyset) => [keyset.slug, keyset.note])).toEqual([
      ['admin', ''],
      ['ci', ''],
    ])
    expect(account?.keys[0]?.keysets).toEqual([])
  })

  test('a key keeps the icon picked for it', async () => {
    const { aliceId, laptop } = await setup()
    await updateKey(db, aliceId, laptop, { icon: 'server' })
    expect((await loadAccount(db, aliceId))?.keys[0]).toMatchObject({ icon: 'server' })
  })

  test('a key stored without an icon gets one guessed from its comment', async () => {
    const { aliceId, laptop } = await setup()
    await db.prepare('UPDATE keys SET icon = NULL WHERE id = ?').bind(laptop).run()
    // alice@laptop
    expect((await loadAccount(db, aliceId))?.keys[0]?.icon).toBe('laptop')
  })
})

describe('names, comments and notes', () => {
  test('the directory carries the name, the comment and the private note, apart', async () => {
    const aliceId = await signUp(1, 'alice', 'alice')
    await addKeys(db, aliceId, [LAPTOP])
    const key = (await loadAccount(db, aliceId))?.keys[0]
    await updateKey(db, aliceId, key?.id ?? '', {
      name: 'Work laptop',
      note: 'the one with the sticker',
    })
    const lookup = await d1Directory(db).lookup('alice')
    if (lookup.kind !== 'found') throw new Error(lookup.kind)
    expect(lookup.account.keys[0]).toMatchObject({
      name: 'Work laptop',
      comment: 'alice@laptop',
      note: 'the one with the sticker',
    })
  })

  test('a keyset keeps its note', async () => {
    const aliceId = await signUp(1, 'alice', 'alice')
    await createKeyset(db, aliceId, 'ci')
    await saveKeyset(db, aliceId, 'ci', { slug: 'ci', note: 'build runners', keyIds: [] })
    expect((await loadAccount(db, aliceId))?.keysets[0]).toMatchObject({ note: 'build runners' })
  })
})

describe('sessions', () => {
  test('a live session reads the whole account in one go; an expired one reads nothing', async () => {
    const aliceId = await signUp(1, 'alice', 'alice')
    await addKeys(db, aliceId, [LAPTOP])
    await insertSession(db, 'live', aliceId, '2999-01-01T00:00:00Z')
    await insertSession(db, 'old', aliceId, '2000-01-01T00:00:00Z')
    const live = await loadSessionAccount(db, 'live')
    expect(live?.row.id).toBe(aliceId)
    expect(live?.account?.keys.map((key) => key.comment)).toEqual(['alice@laptop'])
    expect(await loadSessionAccount(db, 'old')).toBeNull()
    expect(await loadSessionAccount(db, 'missing')).toBeNull()
  })
})
