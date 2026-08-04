ALTER TABLE passenger_imports ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS passenger_imports_school_idx ON passenger_imports (school_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS passenger_school_active_unique_idx
  ON passenger_school_assignments (passenger_id, school_id) WHERE unassigned_at IS NULL;