-- Allow permanent user removal while preserving historical records.
ALTER TABLE lots ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE lot_versions ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE media_assets ALTER COLUMN uploaded_by DROP NOT NULL;
ALTER TABLE passenger_imports ALTER COLUMN imported_by DROP NOT NULL;

ALTER TABLE lots DROP CONSTRAINT IF EXISTS lots_created_by_fkey;
ALTER TABLE lots ADD CONSTRAINT lots_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE lot_versions DROP CONSTRAINT IF EXISTS lot_versions_created_by_fkey;
ALTER TABLE lot_versions ADD CONSTRAINT lot_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE media_assets DROP CONSTRAINT IF EXISTS media_assets_uploaded_by_fkey;
ALTER TABLE media_assets ADD CONSTRAINT media_assets_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE departures DROP CONSTRAINT IF EXISTS departures_created_by_fkey;
ALTER TABLE departures ADD CONSTRAINT departures_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE passenger_imports DROP CONSTRAINT IF EXISTS passenger_imports_imported_by_fkey;
ALTER TABLE passenger_imports ADD CONSTRAINT passenger_imports_imported_by_fkey FOREIGN KEY (imported_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public_school_links DROP CONSTRAINT IF EXISTS public_school_links_generated_by_fkey;
ALTER TABLE public_school_links ADD CONSTRAINT public_school_links_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public_school_links DROP CONSTRAINT IF EXISTS public_school_links_revoked_by_fkey;
ALTER TABLE public_school_links ADD CONSTRAINT public_school_links_revoked_by_fkey FOREIGN KEY (revoked_by) REFERENCES users(id) ON DELETE SET NULL;
