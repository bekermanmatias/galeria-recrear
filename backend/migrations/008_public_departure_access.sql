ALTER TABLE departures
  ADD COLUMN IF NOT EXISTS public_code VARCHAR(48),
  ADD COLUMN IF NOT EXISTS public_access_active BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE departures
SET public_code = upper(type::text) || '-' || upper(substr(replace(id::text, '-', ''), 1, 8))
WHERE public_code IS NULL;

ALTER TABLE departures ALTER COLUMN public_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS departures_public_code_unique_idx ON departures (lower(public_code));
CREATE INDEX IF NOT EXISTS departures_public_active_idx ON departures (public_access_active) WHERE public_access_active = TRUE;