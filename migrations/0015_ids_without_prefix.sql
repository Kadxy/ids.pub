-- Accounts and groups drop their prefixes too, as keys did in 0014: every id is 32 hex digits.
-- Nothing cascades on update, so every column that points at an id changes with it. Foreign keys
-- are checked when the migration commits, by which time both sides match again.
PRAGMA defer_foreign_keys = true;

UPDATE names SET account_id = substr(account_id, 6) WHERE account_id LIKE 'acct\_%' ESCAPE '\';
UPDATE keys SET account_id = substr(account_id, 6) WHERE account_id LIKE 'acct\_%' ESCAPE '\';
UPDATE keysets SET account_id = substr(account_id, 6) WHERE account_id LIKE 'acct\_%' ESCAPE '\';
UPDATE sessions SET account_id = substr(account_id, 6) WHERE account_id LIKE 'acct\_%' ESCAPE '\';
UPDATE name_changes SET account_id = substr(account_id, 6) WHERE account_id LIKE 'acct\_%' ESCAPE '\';
UPDATE accounts SET id = substr(id, 6) WHERE id LIKE 'acct\_%' ESCAPE '\';

UPDATE keyset_keys SET keyset_id = substr(keyset_id, 6) WHERE keyset_id LIKE 'kset\_%' ESCAPE '\';
UPDATE keysets SET id = substr(id, 6) WHERE id LIKE 'kset\_%' ESCAPE '\';
