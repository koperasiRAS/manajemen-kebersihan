-- ============================================================
-- Row Level Security Policies
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

ALTER TABLE cleaning_reports ENABLE ROW LEVEL SECURITY;

ALTER TABLE discipline_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Users policies
-- ============================================================

-- Employees can read their own profile
CREATE POLICY "Users can read own profile" ON users FOR
SELECT USING (auth.uid () = id);

-- Owners can read all users
CREATE POLICY "Owners can read all users" ON users FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM users
            WHERE
                id = auth.uid ()
                AND role = 'owner'
        )
    );

-- ============================================================
-- Cleaning Reports policies
-- ============================================================

-- Employees can read their own reports
CREATE POLICY "Employees can read own reports" ON cleaning_reports FOR
SELECT USING (user_id = auth.uid ());

-- Employees can insert their own reports
CREATE POLICY "Employees can insert own reports" ON cleaning_reports FOR
INSERT
WITH
    CHECK (user_id = auth.uid ());

-- Owners can read all reports
CREATE POLICY "Owners can read all reports" ON cleaning_reports FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM users
            WHERE
                id = auth.uid ()
                AND role = 'owner'
        )
    );

-- Owners can update report status (for rejection)
CREATE POLICY "Owners can update report status" ON cleaning_reports FOR
UPDATE USING (
    EXISTS (
        SELECT 1
        FROM users
        WHERE
            id = auth.uid ()
            AND role = 'owner'
    )
)
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

-- No delete policy for anyone (reports cannot be deleted)

-- ============================================================
-- Discipline Log policies
-- ============================================================

-- Employees can read their own discipline log
CREATE POLICY "Employees can read own discipline log" ON discipline_log FOR
SELECT USING (user_id = auth.uid ());

-- Owners can read all discipline logs
CREATE POLICY "Owners can read all discipline logs" ON discipline_log FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM users
            WHERE
                id = auth.uid ()
                AND role = 'owner'
        )
    );

-- ============================================================
-- Storage policies for cleaning-photos bucket
-- ============================================================

-- Employees can upload photos to their own folder
CREATE POLICY "Employees can upload photos" ON storage.objects FOR
INSERT
WITH
    CHECK (
        bucket_id = 'cleaning-photos'
        AND auth.uid () IS NOT NULL
    );

-- Authenticated users can read photos (via signed URLs)
CREATE POLICY "Authenticated users can read photos" ON storage.objects FOR
SELECT USING (
        bucket_id = 'cleaning-photos'
        AND auth.uid () IS NOT NULL
    );