-- A key's picture is a shape in a colour, both picked by the owner. Rows without either get one
-- derived from the key itself when read.
ALTER TABLE keys ADD COLUMN shape TEXT;

-- A private account still serves its keys to machines; people see only that the name is taken.
ALTER TABLE accounts ADD COLUMN private INTEGER NOT NULL DEFAULT 0;
