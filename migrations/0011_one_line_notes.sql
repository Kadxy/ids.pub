-- Notes are one line now: line breaks and tabs become spaces.
UPDATE keys SET note = trim(replace(replace(replace(note, char(13), ' '), char(10), ' '), char(9), ' '))
  WHERE note GLOB ('*' || char(10) || '*') OR note GLOB ('*' || char(13) || '*') OR note GLOB ('*' || char(9) || '*');
UPDATE keysets SET note = trim(replace(replace(replace(note, char(13), ' '), char(10), ' '), char(9), ' '))
  WHERE note GLOB ('*' || char(10) || '*') OR note GLOB ('*' || char(13) || '*') OR note GLOB ('*' || char(9) || '*');
