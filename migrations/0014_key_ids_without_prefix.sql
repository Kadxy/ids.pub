-- A key's id is in its page's URL, /keys/<id>, so it drops the `key_` prefix: 32 hex digits, as
-- new keys get. Memberships point at key ids too, so they change with them; foreign keys are
-- checked when the migration commits, by which time both sides match again.
PRAGMA defer_foreign_keys = true;

UPDATE keyset_keys SET key_id = substr(key_id, 5) WHERE key_id LIKE 'key\_%' ESCAPE '\';
UPDATE keys SET id = substr(id, 5) WHERE id LIKE 'key\_%' ESCAPE '\';
