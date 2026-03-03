-- Migration 006: Before/After photo + Draft status support

-- 1. Add 'draft' to the report_status enum type
ALTER TYPE report_status ADD VALUE IF NOT EXISTS 'draft';

-- 2. Add photo_before_url column
ALTER TABLE cleaning_reports
ADD COLUMN IF NOT EXISTS photo_before_url TEXT DEFAULT NULL;

-- 3. Make photo_url nullable (draft reports only have before photo initially)
ALTER TABLE cleaning_reports ALTER COLUMN photo_url DROP NOT NULL;

COMMENT ON COLUMN cleaning_reports.photo_before_url IS 'Storage path for before-cleaning photo';

COMMENT ON COLUMN cleaning_reports.photo_url IS 'Storage path for after-cleaning photo (null when draft)';