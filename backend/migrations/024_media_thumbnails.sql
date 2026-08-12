ALTER TABLE media_assets
  ADD COLUMN IF NOT EXISTS thumbnail_drive_file_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS thumbnail_mime_type VARCHAR(128),
  ADD COLUMN IF NOT EXISTS thumbnail_size_bytes BIGINT;

CREATE INDEX IF NOT EXISTS media_assets_thumbnail_pending_idx
  ON media_assets (id)
  WHERE thumbnail_drive_file_id IS NULL AND kind = 'IMAGE' AND status = 'APPROVED';
