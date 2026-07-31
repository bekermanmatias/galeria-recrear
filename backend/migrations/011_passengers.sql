CREATE TABLE IF NOT EXISTS passenger_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name VARCHAR(512) NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  created_rows INTEGER NOT NULL DEFAULT 0,
  updated_rows INTEGER NOT NULL DEFAULT 0,
  rejected_rows INTEGER NOT NULL DEFAULT 0,
  imported_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS passengers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_number VARCHAR(80),
  full_name VARCHAR(240) NOT NULL,
  document_type VARCHAR(40) NOT NULL,
  document_number VARCHAR(80) NOT NULL,
  birth_date DATE,
  document_expires_at DATE,
  country VARCHAR(100),
  passenger_status VARCHAR(100),
  bonus VARCHAR(100),
  phone VARCHAR(80),
  mobile VARCHAR(80),
  email VARCHAR(320),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  source_import_id UUID REFERENCES passenger_imports(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deactivated_at TIMESTAMPTZ,
  deactivated_by UUID REFERENCES users(id),
  UNIQUE (document_type, document_number)
);

CREATE INDEX IF NOT EXISTS passengers_search_idx
  ON passengers (active, full_name);
CREATE INDEX IF NOT EXISTS passengers_external_number_idx
  ON passengers (external_number);

CREATE TABLE IF NOT EXISTS passenger_school_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id UUID NOT NULL REFERENCES passengers(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unassigned_at TIMESTAMPTZ,
  assigned_by UUID REFERENCES users(id),
  UNIQUE (passenger_id, school_id, assigned_at)
);
CREATE INDEX IF NOT EXISTS passenger_school_assignments_active_idx
  ON passenger_school_assignments (school_id, passenger_id) WHERE unassigned_at IS NULL;

CREATE TABLE IF NOT EXISTS passenger_departure_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id UUID NOT NULL REFERENCES passengers(id) ON DELETE CASCADE,
  departure_id UUID NOT NULL REFERENCES departures(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unassigned_at TIMESTAMPTZ,
  assigned_by UUID REFERENCES users(id),
  UNIQUE (passenger_id, departure_id, assigned_at)
);
CREATE INDEX IF NOT EXISTS passenger_departure_assignments_active_idx
  ON passenger_departure_assignments (departure_id, passenger_id) WHERE unassigned_at IS NULL;

DROP TRIGGER IF EXISTS passengers_touch_updated_at ON passengers;
CREATE TRIGGER passengers_touch_updated_at
  BEFORE UPDATE ON passengers FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
