-- A key has three texts:
--   name     what people see, in the console and on the public page
--   comment  what follows the key in every served line (the authorized_keys comment)
--   note     a private note only the owner sees
-- Until now the name doubled as the comment, so existing keys keep serving exactly what they did.
ALTER TABLE keys ADD COLUMN comment TEXT NOT NULL DEFAULT '';
ALTER TABLE keys ADD COLUMN note TEXT NOT NULL DEFAULT '';
UPDATE keys SET comment = name;

-- Keysets get a private note too, and stay off the public page unless the owner lists them.
-- Unlisted keysets still answer at their address; they just aren't shown.
ALTER TABLE keysets ADD COLUMN note TEXT NOT NULL DEFAULT '';
ALTER TABLE keysets ADD COLUMN listed INTEGER NOT NULL DEFAULT 0;
