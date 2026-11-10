-- What kind of key a row holds. Only 'ssh' exists today. `type` stays the algorithm within the
-- kind (ssh-ed25519, ecdsa-sha2-nistp256, …), so another kind of key, such as a signing key, can
-- live in this table later without changing what is already here.
ALTER TABLE keys ADD COLUMN kind TEXT NOT NULL DEFAULT 'ssh';
