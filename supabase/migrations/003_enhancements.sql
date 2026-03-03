-- ============================================================
-- Enhancement Migration: All new features
-- ============================================================

-- 1. Add is_active field to users (for deactivation)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- 2. Add geolocation to cleaning_reports
ALTER TABLE cleaning_reports
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;

ALTER TABLE cleaning_reports
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- 3. Add rating to cleaning_reports (owner rates 1-5)
ALTER TABLE cleaning_reports
ADD COLUMN IF NOT EXISTS rating INTEGER CHECK (
    rating >= 1
    AND rating <= 5
);

ALTER TABLE cleaning_reports
ADD COLUMN IF NOT EXISTS rating_note TEXT;

-- ============================================================
-- 4. Locations table (multi-location support)
-- ============================================================
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- Everyone can read locations
CREATE POLICY "Authenticated users can read locations" ON locations FOR
SELECT USING (auth.uid () IS NOT NULL);

-- Only owners can manage locations
CREATE POLICY "Owners can manage locations" ON locations FOR ALL USING (
    EXISTS (
        SELECT 1
        FROM users
        WHERE
            id = auth.uid ()
            AND role = 'owner'
    )
);

-- Add location_id to cleaning_reports
ALTER TABLE cleaning_reports
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations (id);

-- ============================================================
-- 5. Cleaning schedules table
-- ============================================================
CREATE TABLE IF NOT EXISTS cleaning_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations (id),
    day_of_week INTEGER NOT NULL CHECK (
        day_of_week >= 0
        AND day_of_week <= 6
    ), -- 0=Sunday
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, day_of_week)
);

ALTER TABLE cleaning_schedules ENABLE ROW LEVEL SECURITY;

-- Employees can read their own schedule
CREATE POLICY "Employees can read own schedule" ON cleaning_schedules FOR
SELECT USING (user_id = auth.uid ());

-- Owners can read all schedules
CREATE POLICY "Owners can read all schedules" ON cleaning_schedules FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM users
            WHERE
                id = auth.uid ()
                AND role = 'owner'
        )
    );

-- Owners can manage schedules
CREATE POLICY "Owners can manage schedules" ON cleaning_schedules FOR ALL USING (
    EXISTS (
        SELECT 1
        FROM users
        WHERE
            id = auth.uid ()
            AND role = 'owner'
    )
);

-- ============================================================
-- 6. Audit log table
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    user_id UUID REFERENCES users (id),
    action TEXT NOT NULL, -- 'login', 'report_reject', 'user_create', 'user_deactivate', etc.
    target_type TEXT, -- 'user', 'report', 'schedule'
    target_id UUID,
    details JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user_id ON audit_log (user_id);

CREATE INDEX idx_audit_log_action ON audit_log (action);

CREATE INDEX idx_audit_log_created_at ON audit_log (created_at);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Only owners can read audit logs
CREATE POLICY "Owners can read audit logs" ON audit_log FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM users
            WHERE
                id = auth.uid ()
                AND role = 'owner'
        )
    );

-- Anyone authenticated can insert (for logging their own actions)
CREATE POLICY "Authenticated users can insert audit logs" ON audit_log FOR
INSERT
WITH
    CHECK (auth.uid () IS NOT NULL);

-- ============================================================
-- 7. Owner can insert users (for user management)
-- ============================================================
CREATE POLICY "Owners can insert users" ON users FOR
INSERT
WITH
    CHECK (
        EXISTS (
            SELECT 1
            FROM users
            WHERE
                id = auth.uid ()
                AND role = 'owner'
        )
    );

CREATE POLICY "Owners can update users" ON users FOR
UPDATE USING (
    EXISTS (
        SELECT 1
        FROM users
        WHERE
            id = auth.uid ()
            AND role = 'owner'
    )
);

-- ============================================================
-- 8. Data retention function (cleanup old photos > 6 months)
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_old_data(retention_months INTEGER DEFAULT 6)
RETURNS void AS $$
DECLARE
  cutoff_date DATE;
BEGIN
  cutoff_date := CURRENT_DATE - (retention_months || ' months')::INTERVAL;
  
  -- Delete old audit logs (keep 1 year)
  DELETE FROM audit_log WHERE created_at < (CURRENT_DATE - INTERVAL '1 year');
  
  -- Note: Photo deletion from storage must be done via Edge Function
  -- This function just marks old records for potential cleanup
  
  RAISE NOTICE 'Cleanup completed. Cutoff date: %', cutoff_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;