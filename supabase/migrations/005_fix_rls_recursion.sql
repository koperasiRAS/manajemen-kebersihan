-- ============================================================
-- FIX: Infinite recursion in users table RLS policies
-- The old policies used "SELECT FROM users" inside users policies
-- which causes circular dependency. Fix: use auth.uid() directly.
-- ============================================================

-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can read own profile" ON users;

DROP POLICY IF EXISTS "Owners can read all users" ON users;

DROP POLICY IF EXISTS "Owner can manage users" ON users;

DROP POLICY IF EXISTS "Owner can update users" ON users;

-- NEW: All authenticated users can read all user profiles
-- This is safe because the table only contains name/role/phone (no sensitive data)
CREATE POLICY "Authenticated users can read users" ON users FOR
SELECT USING (auth.uid () IS NOT NULL);

-- NEW: Users can update their own profile
CREATE POLICY "Users can update own profile" ON users FOR
UPDATE USING (auth.uid () = id)
WITH
    CHECK (auth.uid () = id);

-- NEW: Service role handles inserts (via API route)
-- No INSERT policy needed for regular users — only the API with service_role can insert

-- ============================================================
-- FIX: Also fix other tables that reference users for owner check
-- Use a security definer function instead of direct subquery
-- ============================================================

-- Create a helper function that bypasses RLS to check owner role
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner'
  );
$$;

-- Fix cleaning_reports policies that reference users
DROP POLICY IF EXISTS "Owners can read all reports" ON cleaning_reports;

DROP POLICY IF EXISTS "Owners can update report status" ON cleaning_reports;

CREATE POLICY "Owners can read all reports" ON cleaning_reports FOR
SELECT USING (public.is_owner ());

CREATE POLICY "Owners can update report status" ON cleaning_reports FOR
UPDATE USING (public.is_owner ())
WITH
    CHECK (public.is_owner ());

-- Fix discipline_log policies
DROP POLICY IF EXISTS "Owners can read all discipline logs" ON discipline_log;

CREATE POLICY "Owners can read all discipline logs" ON discipline_log FOR
SELECT USING (public.is_owner ());

-- Fix delete policy for reports
DROP POLICY IF EXISTS "Owners can delete reports" ON cleaning_reports;

CREATE POLICY "Owners can delete reports" ON cleaning_reports FOR DELETE USING (public.is_owner ());

-- Fix locations policies (from 003_enhancements)
DROP POLICY IF EXISTS "Owners can manage locations" ON locations;

CREATE POLICY "Owners can manage locations" ON locations FOR ALL USING (public.is_owner ());

-- Fix schedules policies
DROP POLICY IF EXISTS "Owners can manage schedules" ON cleaning_schedules;

CREATE POLICY "Owners can manage schedules" ON cleaning_schedules FOR ALL USING (public.is_owner ());

-- Fix audit_log policies
DROP POLICY IF EXISTS "Owners can read audit log" ON audit_log;

DROP POLICY IF EXISTS "Authenticated can insert audit" ON audit_log;

CREATE POLICY "Owners can read audit log" ON audit_log FOR
SELECT USING (public.is_owner ());

CREATE POLICY "Authenticated can insert audit" ON audit_log FOR
INSERT
WITH
    CHECK (auth.uid () IS NOT NULL);