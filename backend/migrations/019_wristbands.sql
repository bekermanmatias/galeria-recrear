-- Migration 019: Wristband QR linking for passengers
ALTER TABLE passengers ADD COLUMN IF NOT EXISTS wristband_code VARCHAR(80);
ALTER TABLE passengers ADD COLUMN IF NOT EXISTS wristband_linked_at TIMESTAMPTZ;
ALTER TABLE passengers ADD COLUMN IF NOT EXISTS wristband_linked_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS passengers_wristband_code_idx
  ON passengers(wristband_code)
  WHERE wristband_code IS NOT NULL;
