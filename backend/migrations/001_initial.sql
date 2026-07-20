CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('ADMIN', 'COORDINATOR', 'PARENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE membership_role AS ENUM ('COORDINATOR', 'PARENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE lot_version_status AS ENUM ('DRAFT', 'UPLOADING', 'PENDING', 'PUBLISHED', 'REJECTED', 'ERROR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE media_kind AS ENUM ('IMAGE', 'VIDEO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE media_status AS ENUM ('UPLOADING', 'READY', 'APPROVED', 'REJECTED', 'ERROR', 'DELETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE ingestion_source AS ENUM ('PORTAL', 'WHATSAPP');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(160) NOT NULL,
  email VARCHAR(320) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(160) NOT NULL,
  code VARCHAR(32) NOT NULL UNIQUE,
  bot_code VARCHAR(32) NOT NULL UNIQUE,
  start_date DATE,
  end_date DATE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS user_schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  membership_role membership_role NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, school_id, membership_role)
);
CREATE UNIQUE INDEX IF NOT EXISTS user_one_active_parent_school
  ON user_schools(user_id) WHERE membership_role = 'PARENT' AND active;

CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  bot_code VARCHAR(32) NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  bot_code VARCHAR(32) NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_activities (
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (school_id, activity_id)
);
CREATE TABLE IF NOT EXISTS school_shifts (
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (school_id, shift_id)
);

CREATE TABLE IF NOT EXISTS lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  activity_id UUID NOT NULL REFERENCES activities(id),
  shift_id UUID NOT NULL REFERENCES shifts(id),
  event_date DATE NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  current_published_version_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, activity_id, shift_id, event_date)
);

CREATE TABLE IF NOT EXISTS lot_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id UUID NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  status lot_version_status NOT NULL DEFAULT 'DRAFT',
  source ingestion_source NOT NULL DEFAULT 'PORTAL',
  external_reference VARCHAR(255),
  drive_folder_id VARCHAR(255),
  created_by UUID NOT NULL REFERENCES users(id),
  submitted_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lot_id, version_number)
);
ALTER TABLE lots DROP CONSTRAINT IF EXISTS lots_current_published_version_id_fkey;
ALTER TABLE lots ADD CONSTRAINT lots_current_published_version_id_fkey
  FOREIGN KEY (current_published_version_id) REFERENCES lot_versions(id);

CREATE TABLE IF NOT EXISTS media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_version_id UUID NOT NULL REFERENCES lot_versions(id) ON DELETE CASCADE,
  kind media_kind NOT NULL,
  status media_status NOT NULL DEFAULT 'UPLOADING',
  original_name VARCHAR(512) NOT NULL,
  mime_type VARCHAR(128) NOT NULL,
  size_bytes BIGINT NOT NULL,
  sha256 CHAR(64) NOT NULL,
  drive_file_id VARCHAR(255) UNIQUE,
  preview_drive_file_id VARCHAR(255),
  width INTEGER,
  height INTEGER,
  duration_seconds INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  moderated_by UUID REFERENCES users(id),
  moderated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  purge_after TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS media_assets_version_idx ON media_assets(lot_version_id, status);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS users_touch_updated_at ON users;
DROP TRIGGER IF EXISTS schools_touch_updated_at ON schools;
DROP TRIGGER IF EXISTS activities_touch_updated_at ON activities;
DROP TRIGGER IF EXISTS shifts_touch_updated_at ON shifts;
DROP TRIGGER IF EXISTS lots_touch_updated_at ON lots;
DROP TRIGGER IF EXISTS lot_versions_touch_updated_at ON lot_versions;
DROP TRIGGER IF EXISTS media_assets_touch_updated_at ON media_assets;
CREATE TRIGGER users_touch_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER schools_touch_updated_at BEFORE UPDATE ON schools FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER activities_touch_updated_at BEFORE UPDATE ON activities FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER shifts_touch_updated_at BEFORE UPDATE ON shifts FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER lots_touch_updated_at BEFORE UPDATE ON lots FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER lot_versions_touch_updated_at BEFORE UPDATE ON lot_versions FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER media_assets_touch_updated_at BEFORE UPDATE ON media_assets FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
