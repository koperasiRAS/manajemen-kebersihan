-- ============================================================
-- Migration 008: Allow employees to update their own draft reports
-- ============================================================

-- Employees need to update their own drafts to complete them (draft → valid)
CREATE POLICY "Employees can update own draft reports" ON cleaning_reports FOR
UPDATE USING (
    user_id = auth.uid ()
    AND status = 'draft'
)
WITH
    CHECK (user_id = auth.uid ());