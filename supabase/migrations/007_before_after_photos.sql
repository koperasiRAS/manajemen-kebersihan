-- ============================================================
-- Migration 007: Before/After photo + Draft status support
-- ============================================================

-- 1. Add 'draft' to the report_status enum type
ALTER TYPE report_status ADD VALUE IF NOT EXISTS 'draft';

-- 2. Add photo_before_url column
ALTER TABLE cleaning_reports
ADD COLUMN IF NOT EXISTS photo_before_url TEXT DEFAULT NULL;

-- 3. Make photo_url nullable (draft reports only have before photo initially)
ALTER TABLE cleaning_reports ALTER COLUMN photo_url DROP NOT NULL;

-- 4. Update the daily limit trigger to skip drafts and not override submitted_at for drafts
CREATE OR REPLACE FUNCTION check_daily_report_limit()
RETURNS TRIGGER AS $$
DECLARE
  report_count INTEGER;
BEGIN
  -- Only enforce limit for non-draft reports (valid/rejected)
  IF NEW.status = 'draft' THEN
    -- For drafts, set created_at but don't override submitted_at
    RETURN NEW;
  END IF;

  -- Count only completed (non-draft) reports today (WIB timezone)
  SELECT COUNT(*) INTO report_count
  FROM cleaning_reports
  WHERE user_id = NEW.user_id
    AND submission_date = (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE
    AND status != 'draft';

  IF report_count >= 3 THEN
    RAISE EXCEPTION 'Maximum daily cleaning reports reached (3).';
  END IF;

  -- Auto-set submission_date (WIB) and submitted_at for completed reports
  NEW.submission_date := (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE;
  NEW.submitted_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON COLUMN cleaning_reports.photo_before_url IS 'Storage path for before-cleaning photo';

COMMENT ON COLUMN cleaning_reports.photo_url IS 'Storage path for after-cleaning photo (null when draft)';