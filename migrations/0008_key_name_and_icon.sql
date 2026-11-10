-- Keys get a name of their own again: what the owner calls the key, apart from the comment that
-- goes out with it. Existing keys start with their comment as their name.
ALTER TABLE keys ADD COLUMN name TEXT NOT NULL DEFAULT '';
UPDATE keys SET name = comment;

-- A key's picture is now a glyph (laptop, server, security key…) on a colour, not a drawn shape.
-- The old shapes mean nothing as glyphs, so each key gets one guessed from its comment when read.
ALTER TABLE keys RENAME COLUMN shape TO icon;
UPDATE keys SET icon = NULL;
