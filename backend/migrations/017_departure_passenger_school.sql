ALTER TABLE passenger_departure_assignments ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE RESTRICT;

WITH unique_school AS (
  SELECT pda.id, (ARRAY_AGG(psa.school_id))[1] AS school_id
  FROM passenger_departure_assignments pda
  JOIN passenger_school_assignments psa ON psa.passenger_id=pda.passenger_id AND psa.unassigned_at IS NULL
  JOIN departure_schools ds ON ds.departure_id=pda.departure_id AND ds.school_id=psa.school_id
  WHERE pda.school_id IS NULL
  GROUP BY pda.id
  HAVING COUNT(DISTINCT psa.school_id)=1
)
UPDATE passenger_departure_assignments pda
SET school_id=unique_school.school_id
FROM unique_school
WHERE pda.id=unique_school.id;

CREATE INDEX IF NOT EXISTS passenger_departure_school_active_idx ON passenger_departure_assignments (departure_id, school_id, passenger_id) WHERE unassigned_at IS NULL;