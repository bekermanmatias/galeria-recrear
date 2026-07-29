ALTER TABLE public_school_links
  ADD COLUMN IF NOT EXISTS token_value TEXT;
