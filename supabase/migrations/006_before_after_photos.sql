-- Migration 006: Before/After photo + Draft status support
-- Add photo_before_url column
ALTER TABLE cleaning_reports
ADD COLUMN IF NOT EXISTS photo_before_url TEXT DEFAULT NULL;

-- Make photo_url nullable (draft reports only have before photo)
ALTER TABLE cleaning_reports ALTER COLUMN photo_url DROP NOT NULL;

-- Allow 'draft' status (the existing CHECK constraint may need updating)
-- Drop old constraint if exists
DO $$
BEGIN
  ALTER TABLE cleaning_reports DROP CONSTRAINT IF EXISTS cleaning_reports_status_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Add updated constraint
ALTER TABLE cleaning_reports
ADD CONSTRAINT cleaning_reports_status_check CHECK (
    status IN ('draft', 'valid', 'rejected')
);

-- Set default status to draft
ALTER TABLE cleaning_reports ALTER COLUMN status SET DEFAULT 'draft';

COMMENT ON COLUMN cleaning_reports.photo_before_url IS 'Storage path for before-cleaning photo';

COMMENT ON COLUMN cleaning_reports.photo_url IS 'Storage path for after-cleaning photo (null when draft)';