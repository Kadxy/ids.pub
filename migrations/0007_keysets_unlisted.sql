-- Groups are never shown on the public page and can't be enumerated: only someone who knows a
-- group's address gets its keys. So a keyset no longer has a listed flag.
ALTER TABLE keysets DROP COLUMN listed;
