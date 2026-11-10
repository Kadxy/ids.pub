-- Accounts are keyed by their own id; the GitHub numeric id is how someone signs in.
-- github_login and github_two_factor are snapshots from the last sign-in.
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  github_id INTEGER NOT NULL UNIQUE,
  github_login TEXT NOT NULL,
  github_two_factor INTEGER,
  name TEXT UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Every name ever used. Rows are never deleted, so a name can never be claimed twice.
-- status: current (the account's name), active (earlier name, still serving),
-- retired (earlier name, answers 410), tombstone (account deleted, answers 410).
CREATE TABLE names (
  name TEXT PRIMARY KEY,
  account_id TEXT REFERENCES accounts (id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('current', 'active', 'retired', 'tombstone')),
  claimed_at TEXT NOT NULL
);
CREATE INDEX names_account ON names (account_id);

CREATE TABLE keys (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  blob TEXT NOT NULL,
  name TEXT NOT NULL COLLATE NOCASE,
  created_at TEXT NOT NULL,
  UNIQUE (account_id, blob),
  UNIQUE (account_id, name)
);

CREATE TABLE keysets (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (account_id, slug)
);

CREATE TABLE keyset_keys (
  keyset_id TEXT NOT NULL REFERENCES keysets (id) ON DELETE CASCADE,
  key_id TEXT NOT NULL REFERENCES keys (id) ON DELETE CASCADE,
  PRIMARY KEY (keyset_id, key_id)
);
CREATE INDEX keyset_keys_key ON keyset_keys (key_id);

-- Only the SHA-256 of the session token is stored; the token itself lives in the cookie.
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX sessions_account ON sessions (account_id);
