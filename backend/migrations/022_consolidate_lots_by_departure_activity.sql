-- Un álbum queda definido por salida + actividad. Las versiones son incrementales.
CREATE TABLE IF NOT EXISTS lot_consolidation_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '30 days',
  snapshot JSONB NOT NULL
);

DO $$
DECLARE
  group_row RECORD;
  canonical_id UUID;
  target_version_id UUID;
  published_version_id UUID;
BEGIN
  FOR group_row IN
    SELECT departure_id, activity_id FROM lots WHERE deleted_at IS NULL
    GROUP BY departure_id, activity_id HAVING COUNT(*) > 1
  LOOP
    SELECT id INTO canonical_id FROM lots
    WHERE departure_id = group_row.departure_id AND activity_id IS NOT DISTINCT FROM group_row.activity_id AND deleted_at IS NULL
    ORDER BY event_date DESC, created_at DESC, id DESC LIMIT 1;

    INSERT INTO lot_consolidation_backups (snapshot)
    SELECT jsonb_build_object('departure_id', group_row.departure_id, 'activity_id', group_row.activity_id, 'canonical_lot_id', canonical_id,
      'lots', jsonb_agg(jsonb_build_object('lot', to_jsonb(l), 'versions', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('version', to_jsonb(v), 'media', COALESCE((SELECT jsonb_agg(to_jsonb(m)) FROM media_assets m WHERE m.lot_version_id = v.id), '[]'::jsonb)) ORDER BY v.created_at, v.id)
        FROM lot_versions v WHERE v.lot_id = l.id), '[]'::jsonb))))
    FROM lots l
    WHERE l.departure_id = group_row.departure_id AND l.activity_id IS NOT DISTINCT FROM group_row.activity_id AND l.deleted_at IS NULL;

    WITH temporary_numbers AS (
      SELECT v.id, 1000000 + row_number() OVER (ORDER BY v.created_at, v.id)::int AS next_number
      FROM lot_versions v
      WHERE v.lot_id IN (SELECT id FROM lots WHERE departure_id = group_row.departure_id AND activity_id IS NOT DISTINCT FROM group_row.activity_id AND deleted_at IS NULL)
    )
    UPDATE lot_versions v SET version_number = temporary_numbers.next_number FROM temporary_numbers WHERE v.id = temporary_numbers.id;
    UPDATE lot_versions SET lot_id = canonical_id
    WHERE lot_id IN (SELECT id FROM lots WHERE departure_id = group_row.departure_id AND activity_id IS NOT DISTINCT FROM group_row.activity_id AND deleted_at IS NULL AND id <> canonical_id);

    SELECT id INTO target_version_id FROM lot_versions
    WHERE lot_id = canonical_id AND status IN ('PENDING', 'DRAFT', 'UPLOADING') ORDER BY created_at DESC, id DESC LIMIT 1;
    IF target_version_id IS NOT NULL THEN
      UPDATE media_assets SET lot_version_id = target_version_id
      WHERE lot_version_id IN (SELECT id FROM lot_versions WHERE lot_id = canonical_id AND status IN ('PENDING', 'DRAFT', 'UPLOADING') AND id <> target_version_id);
      UPDATE lot_versions SET status = 'REJECTED', reviewed_at = now(), review_comment = 'Consolidada en otra revisión durante la unificación de álbumes'
      WHERE lot_id = canonical_id AND status IN ('PENDING', 'DRAFT', 'UPLOADING') AND id <> target_version_id;
    END IF;

    WITH numbered AS (SELECT id, row_number() OVER (ORDER BY created_at, id)::int AS next_number FROM lot_versions WHERE lot_id = canonical_id)
    UPDATE lot_versions v SET version_number = numbered.next_number FROM numbered WHERE v.id = numbered.id;
    SELECT id INTO published_version_id FROM lot_versions WHERE lot_id = canonical_id AND status = 'PUBLISHED'
    ORDER BY reviewed_at DESC NULLS LAST, created_at DESC, id DESC LIMIT 1;
    UPDATE lots SET current_published_version_id = published_version_id WHERE id = canonical_id;
    UPDATE lots SET deleted_at = now(), deleted_by = created_by, current_published_version_id = NULL
    WHERE departure_id = group_row.departure_id AND activity_id IS NOT DISTINCT FROM group_row.activity_id AND deleted_at IS NULL AND id <> canonical_id;
  END LOOP;
END $$;

DROP INDEX IF EXISTS lots_departure_unique_idx;
CREATE UNIQUE INDEX IF NOT EXISTS lots_departure_activity_unique_idx ON lots (
  departure_id, COALESCE(activity_id, '00000000-0000-0000-0000-000000000000'::uuid)
) WHERE deleted_at IS NULL;
