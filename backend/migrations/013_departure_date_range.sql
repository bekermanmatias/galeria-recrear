ALTER TABLE departures
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE;

UPDATE departures
SET start_date = COALESCE(start_date, event_date),
    end_date = COALESCE(end_date, event_date)
WHERE start_date IS NULL OR end_date IS NULL;

ALTER TABLE departures
  ALTER COLUMN start_date SET NOT NULL,
  ALTER COLUMN end_date SET NOT NULL;

ALTER TABLE departures
  DROP CONSTRAINT IF EXISTS departures_type_name_destination_event_date_key;

ALTER TABLE departures
  DROP CONSTRAINT IF EXISTS departures_date_range_check;

ALTER TABLE departures
  ADD CONSTRAINT departures_date_range_check CHECK (end_date >= start_date);

CREATE UNIQUE INDEX IF NOT EXISTS departures_identity_date_range_idx
  ON departures (type, name, destination, start_date, end_date);

CREATE INDEX IF NOT EXISTS departures_start_date_idx ON departures (start_date DESC);
CREATE OR REPLACE FUNCTION sync_departure_event_date() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.event_date := NEW.start_date;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS departures_sync_event_date ON departures;
CREATE TRIGGER departures_sync_event_date
  BEFORE INSERT OR UPDATE OF start_date, end_date ON departures
  FOR EACH ROW EXECUTE FUNCTION sync_departure_event_date();