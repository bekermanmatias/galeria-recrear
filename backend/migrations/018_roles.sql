CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(280) NOT NULL DEFAULT '',
  is_system_admin BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX roles_one_system_admin ON roles(is_system_admin) WHERE is_system_admin;
CREATE TABLE role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  module VARCHAR(40) NOT NULL REFERENCES permission_modules(module),
  can_view BOOLEAN NOT NULL DEFAULT FALSE,
  can_create BOOLEAN NOT NULL DEFAULT FALSE,
  can_edit BOOLEAN NOT NULL DEFAULT FALSE,
  can_delete BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY(role_id,module)
);
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_actor_id_fkey;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_actor_id_fkey FOREIGN KEY(actor_id) REFERENCES users(id) ON DELETE SET NULL;
DELETE FROM users WHERE role='PARENT';
INSERT INTO roles(name,description,is_system_admin)
VALUES ('Administrador','Acceso total al sistema',true)
ON CONFLICT (name) DO NOTHING;
INSERT INTO role_permissions(role_id,module,can_view,can_create,can_edit,can_delete)
SELECT r.id,pm.module,true,true,true,true FROM roles r CROSS JOIN permission_modules pm WHERE r.is_system_admin
ON CONFLICT (role_id,module) DO UPDATE SET can_view=true,can_create=true,can_edit=true,can_delete=true;
INSERT INTO roles(name,description)
VALUES ('Coordinador','Permisos operativos predeterminados')
ON CONFLICT (name) DO NOTHING;
INSERT INTO role_permissions(role_id,module,can_view,can_create,can_edit,can_delete)
SELECT r.id,pm.module,
  pm.module IN ('departures','lots','gallery'),
  pm.module='lots',pm.module='lots',false
FROM roles r CROSS JOIN permission_modules pm WHERE r.name='Coordinador'
ON CONFLICT (role_id,module) DO NOTHING;
ALTER TABLE users ADD COLUMN role_id UUID REFERENCES roles(id);
UPDATE users SET role_id=(SELECT id FROM roles WHERE is_system_admin) WHERE role='ADMIN';
UPDATE users SET role_id=(SELECT id FROM roles WHERE name='Coordinador') WHERE role='COORDINATOR' AND role_id IS NULL;
-- Preserve every distinct legacy custom permission matrix in its own migrated role.
DO $$ DECLARE rec RECORD; new_role UUID; idx INT:=1; BEGIN
 FOR rec IN SELECT user_id FROM user_permissions GROUP BY user_id LOOP
   INSERT INTO roles(name,description) VALUES ('Rol migrado '||idx,'Migrado desde permisos personalizados') RETURNING id INTO new_role;
   INSERT INTO role_permissions(role_id,module,can_view,can_create,can_edit,can_delete)
   SELECT new_role,module,can_view,can_create,can_edit,can_delete FROM user_permissions WHERE user_id=rec.user_id;
   UPDATE users SET role_id=new_role WHERE id=rec.user_id;
   idx:=idx+1;
 END LOOP;
END $$;
-- Legacy column remains during compatibility transition; auth uses role_id.
-- Legacy user permissions retained for rollback compatibility.


CREATE OR REPLACE FUNCTION assign_legacy_role_id() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.role_id IS NULL THEN SELECT id INTO NEW.role_id FROM roles WHERE name=CASE WHEN NEW.role='ADMIN' THEN 'Administrador' ELSE 'Coordinador' END; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS users_assign_role_id ON users; CREATE TRIGGER users_assign_role_id BEFORE INSERT OR UPDATE OF role ON users FOR EACH ROW EXECUTE FUNCTION assign_legacy_role_id();
