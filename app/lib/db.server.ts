import {
  type Account,
  type Directory,
  guessIcon,
  type HeldName,
  isKeyIcon,
  type KeyIcon,
  type Lookup,
  type NameStatus,
  type StoredKey,
} from './directory'
import { RENAME_LIMIT, RENAME_WINDOW_DAYS, RENAMES_PER_WINDOW } from './names'
import type { KeyType } from './ssh-key'

/**
 * Everything the app reads from and writes to D1. Every query that touches keys or keysets is
 * scoped to one account id, so one account can never reach another's rows.
 */

export interface AccountRow {
  id: string
  github_id: number
  github_login: string
  github_two_factor: number | null
  name: string | null
}

/** Every id is 32 hex digits, with no prefix: a key's is in its page's URL. */
const newId = () => crypto.randomUUID().replaceAll('-', '')
const now = () => new Date().toISOString()

// ---------------------------------------------------------------- accounts and names

export async function upsertGitHubAccount(
  db: D1Database,
  github: { id: number; login: string; twoFactor: boolean | null },
): Promise<AccountRow> {
  const at = now()
  const twoFactor = github.twoFactor === null ? null : github.twoFactor ? 1 : 0
  await db
    .prepare(
      `INSERT INTO accounts (id, github_id, github_login, github_two_factor, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (github_id) DO UPDATE SET
         github_login = excluded.github_login,
         github_two_factor = excluded.github_two_factor`,
    )
    .bind(newId(), github.id, github.login, twoFactor, at, at)
    .run()
  const row = await db
    .prepare(
      'SELECT id, github_id, github_login, github_two_factor, name FROM accounts WHERE github_id = ?',
    )
    .bind(github.id)
    .first<AccountRow>()
  if (!row) throw new Error('account vanished right after it was written')
  return row
}

export function getAccount(db: D1Database, accountId: string): Promise<AccountRow | null> {
  return db
    .prepare(
      'SELECT id, github_id, github_login, github_two_factor, name FROM accounts WHERE id = ?',
    )
    .bind(accountId)
    .first<AccountRow>()
}

export async function isNameTaken(db: D1Database, name: string): Promise<boolean> {
  return (
    (await db.prepare('SELECT 1 AS taken FROM names WHERE name = ?').bind(name).first('taken')) !==
    null
  )
}

/**
 * Gives an account without a name its first one. Both writes run in one batch, which D1 applies
 * atomically: if the name is taken, nothing changes.
 */
export async function claimFirstName(
  db: D1Database,
  accountId: string,
  name: string,
): Promise<'claimed' | 'taken'> {
  const at = now()
  try {
    const [inserted] = await db.batch([
      db
        .prepare(
          `INSERT INTO names (name, account_id, status, claimed_at)
           SELECT ?, id, 'current', ? FROM accounts WHERE id = ? AND name IS NULL`,
        )
        .bind(name, at, accountId),
      db
        .prepare('UPDATE accounts SET name = ?, updated_at = ? WHERE id = ? AND name IS NULL')
        .bind(name, at, accountId),
    ])
    return inserted?.meta.changes === 1 ? 'claimed' : 'taken'
  } catch (error) {
    if (String(error).includes('UNIQUE')) return 'taken'
    throw error
  }
}

/**
 * Moves an account to another name. The old one keeps serving the same keys until its owner retires
 * it. Moving back to one of the account's own earlier names is allowed, and is a change like any
 * other: two in RENAME_WINDOW_DAYS, RENAME_LIMIT in all.
 * All checks are repeated inside the batch, so two changes racing each other can't both pass.
 */
export async function changeName(
  db: D1Database,
  accountId: string,
  name: string,
): Promise<'changed' | 'taken' | 'refused'> {
  const at = now()
  const cutoff = new Date(Date.now() - RENAME_WINDOW_DAYS * 86_400_000).toISOString()
  const allowed = `(SELECT COUNT(*) FROM name_changes WHERE account_id = ? AND changed_at > ?) < ${RENAMES_PER_WINDOW}
    AND (SELECT COUNT(*) FROM name_changes WHERE account_id = ?) < ${RENAME_LIMIT}`
  // The first two statements stamp the chosen name with this exact time, if the move is allowed;
  // the rest only act on a name carrying that stamp. So either all of it happens or none of it.
  const chosen = 'SELECT 1 FROM names WHERE name = ? AND account_id = ? AND claimed_at = ?'
  try {
    const [claimed, reclaimed] = await db.batch([
      db
        .prepare(
          `INSERT INTO names (name, account_id, status, claimed_at)
           SELECT ?, id, 'active', ? FROM accounts
           WHERE id = ? AND ${allowed}
             AND NOT EXISTS (SELECT 1 FROM names WHERE name = ? AND account_id = ?)`,
        )
        .bind(name, at, accountId, accountId, cutoff, accountId, name, accountId),
      db
        .prepare(
          `UPDATE names SET claimed_at = ?
           WHERE name = ? AND account_id = ? AND status IN ('active', 'retired') AND ${allowed}`,
        )
        .bind(at, name, accountId, accountId, cutoff, accountId),
      db
        .prepare(
          `UPDATE names SET status = 'active'
           WHERE account_id = ? AND status = 'current' AND EXISTS (${chosen})`,
        )
        .bind(accountId, name, accountId, at),
      db
        .prepare(
          `UPDATE names SET status = 'current' WHERE name = ? AND account_id = ? AND claimed_at = ?`,
        )
        .bind(name, accountId, at),
      db
        .prepare(`UPDATE accounts SET name = ?, updated_at = ? WHERE id = ? AND EXISTS (${chosen})`)
        .bind(name, at, accountId, name, accountId, at),
      db
        .prepare(
          `INSERT INTO name_changes (account_id, changed_at) SELECT ?, ? WHERE EXISTS (${chosen})`,
        )
        .bind(accountId, at, name, accountId, at),
    ])
    const moved = (claimed?.meta.changes ?? 0) + (reclaimed?.meta.changes ?? 0)
    return moved > 0 ? 'changed' : 'refused'
  } catch (error) {
    if (String(error).includes('UNIQUE')) return 'taken'
    throw error
  }
}

/**
 * Saves the account's settings besides its name, in one batch: which earlier names still work, and
 * whether the account is private.
 */
/** Turns an earlier name on (it keeps serving the keys) or off (it answers 410). */
export async function setEarlierName(
  db: D1Database,
  accountId: string,
  name: string,
  works: boolean,
) {
  await db.batch([
    db
      .prepare(
        `UPDATE names SET status = ? WHERE name = ? AND account_id = ? AND status IN ('active', 'retired')`,
      )
      .bind(works ? 'active' : 'retired', name, accountId),
    touch(db, accountId),
  ])
}

export async function setPrivate(db: D1Database, accountId: string, hidden: boolean) {
  await db
    .prepare('UPDATE accounts SET private = ?, updated_at = ? WHERE id = ?')
    .bind(hidden ? 1 : 0, now(), accountId)
    .run()
}

/**
 * Deletes an account and everything in it. Its names become tombstones: they answer 410 and are
 * never given to anyone else. Only runs if `confirm` is exactly the current name.
 */
export async function deleteAccount(
  db: D1Database,
  accountId: string,
  confirm: string,
): Promise<boolean> {
  const confirmed = 'EXISTS (SELECT 1 FROM accounts WHERE id = ? AND name = ? COLLATE BINARY)'
  const [, deleted] = await db.batch([
    db
      .prepare(`UPDATE names SET status = 'tombstone' WHERE account_id = ? AND ${confirmed}`)
      .bind(accountId, accountId, confirm),
    db
      .prepare('DELETE FROM accounts WHERE id = ? AND name = ? COLLATE BINARY')
      .bind(accountId, confirm),
  ])
  return (deleted?.meta.changes ?? 0) > 0
}

// ---------------------------------------------------------------- sessions

export async function insertSession(
  db: D1Database,
  sessionId: string,
  accountId: string,
  expiresAt: string,
) {
  await db
    .prepare('INSERT INTO sessions (id, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(sessionId, accountId, now(), expiresAt)
    .run()
}

export function findSessionAccount(db: D1Database, sessionId: string): Promise<AccountRow | null> {
  return db
    .prepare(
      `SELECT a.id, a.github_id, a.github_login, a.github_two_factor, a.name
       FROM sessions s JOIN accounts a ON a.id = s.account_id
       WHERE s.id = ? AND s.expires_at > ?`,
    )
    .bind(sessionId, now())
    .first<AccountRow>()
}

export async function deleteSession(db: D1Database, sessionId: string) {
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run()
}

// ---------------------------------------------------------------- reading an account

interface KeyRow {
  id: string
  type: KeyType
  blob: string
  name: string
  comment: string
  note: string
  icon: string | null
  created_at: string
}

/**
 * Reads everything about one account in a single round trip. `scope` picks the account: by id, or
 * by a live session, so a signed-in request costs one query in total.
 */
async function readAccount(
  db: D1Database,
  scope: { sql: string; params: unknown[] },
): Promise<{ row: AccountRow; account: Account | null } | null> {
  const where = `account_id = (${scope.sql})`
  const [accounts, names, renames, keys, keysets, members] = await db.batch([
    db
      .prepare(
        `SELECT id, github_id, github_login, github_two_factor, name, private, updated_at FROM accounts WHERE id = (${scope.sql})`,
      )
      .bind(...scope.params),
    db
      .prepare(
        `SELECT name, status, claimed_at FROM names WHERE ${where} ORDER BY claimed_at, rowid`,
      )
      .bind(...scope.params),
    db
      .prepare(`SELECT changed_at FROM name_changes WHERE ${where} ORDER BY changed_at`)
      .bind(...scope.params),
    db
      .prepare(
        // Only SSH keys for now; rows of any other kind are left alone until the app knows them.
        `SELECT id, type, blob, name, comment, note, icon, created_at FROM keys WHERE ${where} AND kind = 'ssh' ORDER BY created_at, rowid`,
      )
      .bind(...scope.params),
    db
      .prepare(
        `SELECT slug, note, created_at FROM keysets WHERE ${where} ORDER BY created_at, rowid`,
      )
      .bind(...scope.params),
    db
      .prepare(
        `SELECT kk.key_id, ks.slug FROM keyset_keys kk JOIN keysets ks ON ks.id = kk.keyset_id
         WHERE ks.${where} ORDER BY ks.created_at, ks.rowid`,
      )
      .bind(...scope.params),
  ])
  const row = accounts?.results[0] as
    | (AccountRow & { private: number; updated_at: string })
    | undefined
  if (!row) return null
  const accountRow: AccountRow = {
    id: row.id,
    github_id: row.github_id,
    github_login: row.github_login,
    github_two_factor: row.github_two_factor,
    name: row.name,
  }
  if (!row.name) return { row: accountRow, account: null }

  const membership = new Map<string, string[]>()
  for (const member of (members?.results ?? []) as { key_id: string; slug: string }[]) {
    membership.set(member.key_id, [...(membership.get(member.key_id) ?? []), member.slug])
  }

  return {
    row: accountRow,
    account: {
      id: row.id,
      name: row.name,
      names: (
        (names?.results ?? []) as { name: string; status: NameStatus; claimed_at: string }[]
      ).map(
        (entry): HeldName => ({ name: entry.name, status: entry.status, since: entry.claimed_at }),
      ),
      renames: ((renames?.results ?? []) as { changed_at: string }[]).map(
        (entry) => entry.changed_at,
      ),
      github: {
        id: row.github_id,
        login: row.github_login,
        twoFactor: row.github_two_factor === 1,
      },
      keys: ((keys?.results ?? []) as KeyRow[]).map(
        (key): StoredKey => ({
          id: key.id,
          type: key.type,
          base64: key.blob,
          name: key.name,
          comment: key.comment,
          note: key.note,
          addedAt: key.created_at,
          keysets: membership.get(key.id) ?? [],
          icon: isKeyIcon(key.icon) ? key.icon : guessIcon(key),
        }),
      ),
      keysets: (
        (keysets?.results ?? []) as { slug: string; note: string; created_at: string }[]
      ).map((keyset) => ({
        slug: keyset.slug,
        note: keyset.note,
        createdAt: keyset.created_at,
      })),
      private: row.private === 1,
      updatedAt: row.updated_at,
    },
  }
}

export async function loadAccount(db: D1Database, accountId: string): Promise<Account | null> {
  return (await readAccount(db, { sql: 'SELECT ?', params: [accountId] }))?.account ?? null
}

/** The account behind a live session, read in the same single round trip. */
export function loadSessionAccount(db: D1Database, sessionId: string) {
  return readAccount(db, {
    sql: 'SELECT account_id FROM sessions WHERE id = ? AND expires_at > ?',
    params: [sessionId, now()],
  })
}

/** The public directory: what /<name> and /<name>/<keyset> answer. */
export function d1Directory(db: D1Database): Directory {
  return {
    async lookup(name: string): Promise<Lookup> {
      // Both reads go out at once, so an answer costs one round trip to D1, not two.
      const [row, found] = await Promise.all([
        db
          .prepare('SELECT account_id, status FROM names WHERE name = ?')
          .bind(name)
          .first<{ account_id: string | null; status: NameStatus | 'tombstone' }>(),
        readAccount(db, {
          sql: "SELECT account_id FROM names WHERE name = ? AND status NOT IN ('retired', 'tombstone')",
          params: [name],
        }),
      ])
      if (!row) return { kind: 'missing', requested: name }
      if (row.status === 'retired' || row.status === 'tombstone' || !row.account_id) {
        return { kind: 'gone', requested: name }
      }
      return found?.account
        ? { kind: 'found', account: found.account, requested: name }
        : { kind: 'missing', requested: name }
    },
  }
}

// ---------------------------------------------------------------- changing keys and keysets
// Every change is one batch: the write and the account's updated_at travel together, so a change
// costs a single round trip and either happens completely or not at all.

const touch = (db: D1Database, accountId: string, at = now()) =>
  db.prepare('UPDATE accounts SET updated_at = ? WHERE id = ?').bind(at, accountId)

const isUniqueViolation = (error: unknown) => String(error).includes('UNIQUE')

export interface NewKey {
  icon: KeyIcon
  type: KeyType
  base64: string
  name: string
  comment: string
  note: string
}

export async function addKeys(
  db: D1Database,
  accountId: string,
  keys: NewKey[],
): Promise<'added' | 'duplicate'> {
  const at = now()
  try {
    await db.batch([
      ...keys.map((key) =>
        db
          .prepare(
            `INSERT INTO keys (id, account_id, kind, type, blob, name, comment, note, icon, created_at)
             VALUES (?, ?, 'ssh', ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            newId(),
            accountId,
            key.type,
            key.base64,
            key.name,
            key.comment,
            key.note,
            key.icon,
            at,
          ),
      ),
      touch(db, accountId, at),
    ])
    return 'added'
  } catch (error) {
    if (isUniqueViolation(error)) return 'duplicate'
    throw error
  }
}

/** Any of a key's own fields. Only the ones given change. */
export type KeyFields = Partial<Pick<StoredKey, 'name' | 'comment' | 'note' | 'icon'>>

const KEY_COLUMNS = ['name', 'comment', 'note', 'icon'] as const

export async function updateKey(
  db: D1Database,
  accountId: string,
  keyId: string,
  fields: KeyFields,
) {
  const columns = KEY_COLUMNS.filter((column) => fields[column] !== undefined)
  if (columns.length === 0) return
  await db.batch([
    db
      .prepare(
        `UPDATE keys SET ${columns.map((column) => `${column} = ?`).join(', ')} WHERE id = ? AND account_id = ?`,
      )
      .bind(...columns.map((column) => fields[column]), keyId, accountId),
    touch(db, accountId),
  ])
}

export async function removeKey(db: D1Database, accountId: string, keyId: string) {
  await db.batch([
    db.prepare('DELETE FROM keys WHERE id = ? AND account_id = ?').bind(keyId, accountId),
    touch(db, accountId),
  ])
}

export async function createKeyset(
  db: D1Database,
  accountId: string,
  slug: string,
): Promise<'created' | 'taken'> {
  try {
    await db.batch([
      db
        .prepare('INSERT INTO keysets (id, account_id, slug, created_at) VALUES (?, ?, ?, ?)')
        .bind(newId(), accountId, slug, now()),
      touch(db, accountId),
    ])
    return 'created'
  } catch (error) {
    if (isUniqueViolation(error)) return 'taken'
    throw error
  }
}

export interface KeysetChanges {
  /** The new slug; the same as the current one to keep it. */
  slug: string
  note: string
  /** Exactly the keys it should hold. Key ids from other accounts are ignored. */
  keyIds: string[]
}

/**
 * Saves everything editable about a keyset at once. The members are set while it still has its
 * old slug, and the slug changes last, so a taken slug undoes the whole save.
 */
export async function saveKeyset(
  db: D1Database,
  accountId: string,
  slug: string,
  changes: KeysetChanges,
): Promise<'saved' | 'taken'> {
  const keyset = '(SELECT id FROM keysets WHERE account_id = ? AND slug = ?)'
  try {
    await db.batch([
      db.prepare(`DELETE FROM keyset_keys WHERE keyset_id = ${keyset}`).bind(accountId, slug),
      ...changes.keyIds.map((keyId) =>
        db
          .prepare(
            `INSERT INTO keyset_keys (keyset_id, key_id)
             SELECT ${keyset}, id FROM keys WHERE id = ? AND account_id = ?`,
          )
          .bind(accountId, slug, keyId, accountId),
      ),
      db
        .prepare('UPDATE keysets SET slug = ?, note = ? WHERE account_id = ? AND slug = ?')
        .bind(changes.slug, changes.note, accountId, slug),
      touch(db, accountId),
    ])
    return 'saved'
  } catch (error) {
    if (isUniqueViolation(error)) return 'taken'
    throw error
  }
}

export async function deleteKeyset(db: D1Database, accountId: string, slug: string) {
  await db.batch([
    db.prepare('DELETE FROM keysets WHERE account_id = ? AND slug = ?').bind(accountId, slug),
    touch(db, accountId),
  ])
}
