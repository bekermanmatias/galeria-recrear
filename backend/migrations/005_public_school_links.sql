CREATE TABLE IF NOT EXISTS public_school_links (
  school_id UUID PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by UUID REFERENCES users(id),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS public_school_links_active_idx
  ON public_school_links (active) WHERE active = TRUE;
