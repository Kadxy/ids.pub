-- Every change of an account's username, so that changes can be limited: two in thirty days and
-- five in all. Claiming the first name is not a change.
CREATE TABLE name_changes (
  account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  changed_at TEXT NOT NULL
);
CREATE INDEX name_changes_account ON name_changes (account_id, changed_at);

-- Each name an account took after its first was a change.
INSERT INTO name_changes (account_id, changed_at)
  SELECT n.account_id, n.claimed_at FROM names n
  WHERE n.account_id IS NOT NULL
    AND n.claimed_at > (SELECT MIN(m.claimed_at) FROM names m WHERE m.account_id = n.account_id);
