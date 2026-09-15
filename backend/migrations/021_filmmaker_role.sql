-- Filmmaker is operationally scoped to assigned departures, without
-- administrative access to users, schools, or system configuration.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'FILMMAKER';

INSERT INTO roles(name, description)
VALUES ('Filmmaker', 'Gestiona y modera material audiovisual de sus salidas asignadas')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions(role_id, module, can_view, can_create, can_edit, can_delete)
SELECT r.id, pm.module,
  pm.module IN ('departures', 'lots', 'moderation', 'gallery', 'activities', 'schools', 'passengers'),
  pm.module = 'lots',
  pm.module IN ('lots', 'moderation', 'passengers'),
  pm.module = 'lots'
FROM roles r CROSS JOIN permission_modules pm
WHERE r.name = 'Filmmaker'
ON CONFLICT (role_id, module) DO UPDATE SET
  can_view = EXCLUDED.can_view,
  can_create = EXCLUDED.can_create,
  can_edit = EXCLUDED.can_edit,
  can_delete = EXCLUDED.can_delete;

CREATE OR REPLACE FUNCTION assign_legacy_role_id() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.role_id IS NULL OR TG_OP = 'UPDATE' THEN
    SELECT id INTO NEW.role_id FROM roles WHERE name = CASE NEW.role
      WHEN 'ADMIN' THEN 'Administrador'
      WHEN 'FILMMAKER' THEN 'Filmmaker'
      ELSE 'Coordinador'
    END;
  END IF;
  RETURN NEW;
END $$;
