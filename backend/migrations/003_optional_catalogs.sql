ALTER TABLE lots ALTER COLUMN activity_id DROP NOT NULL;
ALTER TABLE lots ALTER COLUMN shift_id DROP NOT NULL;

-- Remove old unique constraint that didn't allow nulls properly
ALTER TABLE lots DROP CONSTRAINT IF EXISTS lots_school_id_activity_id_shift_id_event_date_key;

-- Add new unique index that treats nulls as identical (using COALESCE) to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS lots_unique_idx ON lots (
  school_id,
  event_date,
  COALESCE(activity_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(shift_id, '00000000-0000-0000-0000-000000000000'::uuid)
);
