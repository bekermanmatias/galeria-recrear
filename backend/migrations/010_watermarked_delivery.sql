ALTER TABLE media_assets
  ADD COLUMN IF NOT EXISTS delivery_drive_file_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS delivery_mime_type VARCHAR(128),
  ADD COLUMN IF NOT EXISTS delivery_size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS delivery_name VARCHAR(512),
  ADD COLUMN IF NOT EXISTS watermark_status VARCHAR(16),
  ADD COLUMN IF NOT EXISTS watermark_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS watermark_error TEXT;

CREATE TABLE IF NOT EXISTS media_watermark_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_asset_id UUID NOT NULL UNIQUE REFERENCES media_assets(id) ON DELETE CASCADE,
  status VARCHAR(16) NOT NULL DEFAULT 'QUEUED',
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status IN ('QUEUED','PROCESSING','DONE','FAILED'))
);

CREATE INDEX IF NOT EXISTS media_watermark_jobs_pending_idx
  ON media_watermark_jobs(status, available_at);
