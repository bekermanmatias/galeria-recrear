CREATE OR REPLACE FUNCTION enable_catalogs_for_new_school() RETURNS trigger AS $$
BEGIN
  INSERT INTO school_activities (school_id, activity_id, enabled)
    SELECT NEW.id, id, TRUE FROM activities WHERE active
    ON CONFLICT (school_id, activity_id) DO NOTHING;
  INSERT INTO school_shifts (school_id, shift_id, enabled)
    SELECT NEW.id, id, TRUE FROM shifts WHERE active
    ON CONFLICT (school_id, shift_id) DO NOTHING;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION enable_new_activity_for_schools() RETURNS trigger AS $$
BEGIN
  INSERT INTO school_activities (school_id, activity_id, enabled)
    SELECT id, NEW.id, TRUE FROM schools WHERE active AND deleted_at IS NULL
    ON CONFLICT (school_id, activity_id) DO NOTHING;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION enable_new_shift_for_schools() RETURNS trigger AS $$
BEGIN
  INSERT INTO school_shifts (school_id, shift_id, enabled)
    SELECT id, NEW.id, TRUE FROM schools WHERE active AND deleted_at IS NULL
    ON CONFLICT (school_id, shift_id) DO NOTHING;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS schools_enable_catalogs ON schools;
DROP TRIGGER IF EXISTS activities_enable_for_schools ON activities;
DROP TRIGGER IF EXISTS shifts_enable_for_schools ON shifts;
CREATE TRIGGER schools_enable_catalogs AFTER INSERT ON schools FOR EACH ROW EXECUTE FUNCTION enable_catalogs_for_new_school();
CREATE TRIGGER activities_enable_for_schools AFTER INSERT ON activities FOR EACH ROW EXECUTE FUNCTION enable_new_activity_for_schools();
CREATE TRIGGER shifts_enable_for_schools AFTER INSERT ON shifts FOR EACH ROW EXECUTE FUNCTION enable_new_shift_for_schools();

INSERT INTO school_activities (school_id, activity_id, enabled)
  SELECT s.id, a.id, TRUE FROM schools s CROSS JOIN activities a
  WHERE s.active AND s.deleted_at IS NULL AND a.active
  ON CONFLICT (school_id, activity_id) DO NOTHING;
INSERT INTO school_shifts (school_id, shift_id, enabled)
  SELECT s.id, sh.id, TRUE FROM schools s CROSS JOIN shifts sh
  WHERE s.active AND s.deleted_at IS NULL AND sh.active
  ON CONFLICT (school_id, shift_id) DO NOTHING;
