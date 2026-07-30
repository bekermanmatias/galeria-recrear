DO $$ BEGIN
  CREATE TYPE departure_type AS ENUM ('MICRO', 'AEREO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS departures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type departure_type NOT NULL,
  name VARCHAR(160) NOT NULL,
  destination VARCHAR(160) NOT NULL,
  event_date DATE NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  archived_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (type, name, destination, event_date)
);

CREATE TABLE IF NOT EXISTS departure_schools (
  departure_id UUID NOT NULL REFERENCES departures(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (departure_id, school_id)
);

CREATE TABLE IF NOT EXISTS departure_coordinators (
  departure_id UUID NOT NULL REFERENCES departures(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (departure_id, user_id)
);

ALTER TABLE lots ADD COLUMN IF NOT EXISTS departure_id UUID REFERENCES departures(id);

INSERT INTO departures (type, name, destination, event_date, created_by)
SELECT 'MICRO', 'Historico - ' || s.name, 'Historico', l.event_date, MIN(l.created_by::text)::uuid
FROM lots l JOIN schools s ON s.id = l.school_id
WHERE l.departure_id IS NULL
GROUP BY s.name, l.school_id, l.event_date
ON CONFLICT (type, name, destination, event_date) DO NOTHING;

UPDATE lots l SET departure_id = d.id
FROM departures d JOIN schools s ON d.name = 'Historico - ' || s.name
WHERE l.school_id = s.id AND l.event_date = d.event_date AND d.type = 'MICRO'
  AND d.destination = 'Historico' AND l.departure_id IS NULL;

INSERT INTO departure_schools (departure_id, school_id)
SELECT DISTINCT l.departure_id, l.school_id FROM lots l
WHERE l.departure_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO departure_coordinators (departure_id, user_id)
SELECT DISTINCT l.departure_id, us.user_id
FROM lots l
JOIN user_schools us ON us.school_id = l.school_id
JOIN users u ON u.id = us.user_id AND u.role = 'COORDINATOR' AND u.active = TRUE
WHERE l.departure_id IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE lots ALTER COLUMN departure_id SET NOT NULL;
ALTER TABLE lots ALTER COLUMN school_id DROP NOT NULL;
ALTER TABLE lots DROP CONSTRAINT IF EXISTS lots_school_id_activity_id_shift_id_event_date_key;
DROP INDEX IF EXISTS lots_unique_idx;
CREATE UNIQUE INDEX IF NOT EXISTS lots_departure_unique_idx ON lots (
  departure_id, event_date,
  COALESCE(activity_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(shift_id, '00000000-0000-0000-0000-000000000000'::uuid)
);
DROP TRIGGER IF EXISTS departures_touch_updated_at ON departures;
CREATE TRIGGER departures_touch_updated_at BEFORE UPDATE ON departures FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE INDEX IF NOT EXISTS lots_departure_idx ON lots(departure_id);
CREATE INDEX IF NOT EXISTS departure_schools_school_idx ON departure_schools(school_id);
CREATE INDEX IF NOT EXISTS departure_coordinators_user_idx ON departure_coordinators(user_id);
