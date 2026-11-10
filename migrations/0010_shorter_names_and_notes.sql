-- Key names are now at most 50 characters and notes at most 200.
UPDATE keys SET name = rtrim(substr(name, 1, 50)) WHERE length(name) > 50;
UPDATE keys SET note = rtrim(substr(note, 1, 200)) WHERE length(note) > 200;
UPDATE keysets SET note = rtrim(substr(note, 1, 200)) WHERE length(note) > 200;
