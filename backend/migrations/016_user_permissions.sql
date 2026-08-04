CREATE TABLE IF NOT EXISTS permission_modules (
  module VARCHAR(40) PRIMARY KEY,
  label VARCHAR(120) NOT NULL
);

INSERT INTO permission_modules(module,label) VALUES
 ('departures','Salidas'),
 ('lots','Lotes'),
 ('moderation','Moderacion'),
 ('gallery','Galeria'),
 ('activities','Actividades'),
 ('schools','Colegios'),
 ('passengers','Pasajeros'),
 ('users','Usuarios'),
 ('imports','Importaciones')
ON CONFLICT (module) DO NOTHING;

CREATE TABLE IF NOT EXISTS user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module VARCHAR(40) NOT NULL REFERENCES permission_modules(module),
  can_view BOOLEAN NOT NULL DEFAULT FALSE,
  can_create BOOLEAN NOT NULL DEFAULT FALSE,
  can_edit BOOLEAN NOT NULL DEFAULT FALSE,
  can_delete BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id,module)
);

CREATE INDEX IF NOT EXISTS user_permissions_user_idx ON user_permissions(user_id);