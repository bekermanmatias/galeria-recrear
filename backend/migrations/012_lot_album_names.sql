-- Nombre personalizado y eliminación lógica de álbumes/lotes.
ALTER TABLE lots
  ADD COLUMN IF NOT EXISTS title VARCHAR(160),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id);

DROP INDEX IF EXISTS lots_departure_activity_date_current_idx;
DROP INDEX IF EXISTS lots_departure_unique_idx;

CREATE UNIQUE INDEX IF NOT EXISTS lots_departure_unique_idx ON lots (
  departure_id,
  event_date,
  COALESCE(activity_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(shift_id, '00000000-0000-0000-0000-000000000000'::uuid)
) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS lots_active_departure_idx
  ON lots (departure_id, event_date)
  WHERE deleted_at IS NULL;