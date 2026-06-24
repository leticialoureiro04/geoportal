ALTER TABLE themes
ADD COLUMN IF NOT EXISTS icon VARCHAR(30) NOT NULL DEFAULT 'marker';

UPDATE themes
SET icon = 'marker'
WHERE icon IS NULL OR icon = '';
