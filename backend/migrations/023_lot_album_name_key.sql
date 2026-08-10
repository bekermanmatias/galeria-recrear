-- La identidad de un álbum incluye su nombre visible. Esto evita mezclar
-- actividades sin catálogo que antes quedaban todas bajo "General".
UPDATE lots l SET title = COALESCE(NULLIF(trim(l.title),''), a.name, 'General')
FROM activities a WHERE a.id=l.activity_id AND l.deleted_at IS NULL;
UPDATE lots SET title = 'General' WHERE (title IS NULL OR trim(title)='') AND deleted_at IS NULL;

DROP INDEX IF EXISTS lots_departure_activity_unique_idx;
DROP INDEX IF EXISTS lots_departure_unique_idx;
CREATE UNIQUE INDEX IF NOT EXISTS lots_departure_activity_name_unique_idx ON lots (
  departure_id,
  COALESCE(activity_id, '00000000-0000-0000-0000-000000000000'::uuid),
  lower(trim(COALESCE(title,'General')))
) WHERE deleted_at IS NULL;
