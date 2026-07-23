-- Backfill missing school/catalog relationships for databases created before
-- catalog default triggers were introduced. Existing disabled assignments stay disabled.
INSERT INTO school_activities (school_id, activity_id, enabled)
SELECT s.id, a.id, TRUE
FROM schools s
CROSS JOIN activities a
WHERE s.active
  AND s.deleted_at IS NULL
  AND a.active
ON CONFLICT (school_id, activity_id) DO NOTHING;

INSERT INTO school_shifts (school_id, shift_id, enabled)
SELECT s.id, sh.id, TRUE
FROM schools s
CROSS JOIN shifts sh
WHERE s.active
  AND s.deleted_at IS NULL
  AND sh.active
ON CONFLICT (school_id, shift_id) DO NOTHING;