-- Add photo_before_url column to cleaning_reports for before/after photo feature
ALTER TABLE cleaning_reports
ADD COLUMN IF NOT EXISTS photo_before_url TEXT DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN cleaning_reports.photo_before_url IS 'Storage path for before-cleaning photo';

COMMENT ON COLUMN cleaning_reports.photo_url IS 'Storage path for after-cleaning photo';