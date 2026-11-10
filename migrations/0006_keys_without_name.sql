-- Keys no longer have a name of their own. The comment, which OpenSSH already uses to tell keys
-- apart (ssh-add -l, ssh-keygen -l), is what the interface shows.
--
-- SQLite can't drop a column that a UNIQUE constraint uses, so the table is rebuilt. Dropping the
-- old table would cascade to keyset_keys, so the memberships are set aside first and put back.
CREATE TABLE keyset_keys_saved AS SELECT keyset_id, key_id FROM keyset_keys;

CREATE TABLE keys_rebuilt (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'ssh',
  type TEXT NOT NULL,
  blob TEXT NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  color TEXT,
  shape TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (account_id, blob)
);
INSERT INTO keys_rebuilt (id, account_id, kind, type, blob, comment, note, color, shape, created_at)
  SELECT id, account_id, kind, type, blob, comment, note, color, shape, created_at FROM keys;

DROP TABLE keys;
ALTER TABLE keys_rebuilt RENAME TO keys;

INSERT INTO keyset_keys (keyset_id, key_id) SELECT keyset_id, key_id FROM keyset_keys_saved;
DROP TABLE keyset_keys_saved;
