-- ============================================================
-- Clean Office Discipline System - Database Schema
-- ============================================================

-- Custom enum types
CREATE TYPE user_role AS ENUM ('owner', 'employee');

CREATE TYPE report_status AS ENUM ('valid', 'rejected');

CREATE TYPE discipline_status AS ENUM ('submitted', 'missed');

-- ============================================================
-- Users table
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'employee',
    phone_number TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Cleaning Reports table
-- ============================================================
CREATE TABLE IF NOT EXISTS cleaning_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    notes TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    submission_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status report_status NOT NULL DEFAULT 'valid',
    rejection_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_cleaning_reports_user_id ON cleaning_reports (user_id);

CREATE INDEX idx_cleaning_reports_submission_date ON cleaning_reports (submission_date);

CREATE INDEX idx_cleaning_reports_user_date ON cleaning_reports (user_id, submission_date);

-- ============================================================
-- Discipline Log table
-- ============================================================
CREATE TABLE IF NOT EXISTS discipline_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status discipline_status NOT NULL DEFAULT 'missed',
    consecutive_missed INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, date)
);

-- Indexes for performance
CREATE INDEX idx_discipline_log_user_id ON discipline_log (user_id);

CREATE INDEX idx_discipline_log_date ON discipline_log (date);

CREATE INDEX idx_discipline_log_user_date ON discipline_log (user_id, date);

-- ============================================================
-- Function: Check daily report limit (max 3)
-- ============================================================
CREATE OR REPLACE FUNCTION check_daily_report_limit()
RETURNS TRIGGER AS $$
DECLARE
  report_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO report_count
  FROM cleaning_reports
  WHERE user_id = NEW.user_id
    AND submission_date = CURRENT_DATE;

  IF report_count >= 3 THEN
    RAISE EXCEPTION 'Maximum daily cleaning reports reached (3).';
  END IF;

  -- Auto-set submission_date to today
  NEW.submission_date := CURRENT_DATE;
  NEW.submitted_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger before insert
CREATE TRIGGER trigger_check_daily_limit
  BEFORE INSERT ON cleaning_reports
  FOR EACH ROW
  EXECUTE FUNCTION check_daily_report_limit();

-- ============================================================
-- Function: Run daily discipline check
-- Called by Edge Function cron at 00:05
-- ============================================================
CREATE OR REPLACE FUNCTION run_daily_discipline_check(check_date DATE)
RETURNS void AS $$
DECLARE
  emp RECORD;
  has_report BOOLEAN;
  prev_consecutive INTEGER;
BEGIN
  FOR emp IN SELECT id FROM users WHERE role = 'employee'
  LOOP
    -- Check if employee submitted at least 1 report on check_date
    SELECT EXISTS(
      SELECT 1 FROM cleaning_reports
      WHERE user_id = emp.id
        AND submission_date = check_date
        AND status = 'valid'
    ) INTO has_report;

    IF has_report THEN
      -- Mark as submitted, reset consecutive counter
      INSERT INTO discipline_log (user_id, date, status, consecutive_missed)
      VALUES (emp.id, check_date, 'submitted', 0)
      ON CONFLICT (user_id, date) DO UPDATE
      SET status = 'submitted', consecutive_missed = 0;
    ELSE
      -- Get previous consecutive missed count
      SELECT COALESCE(
        (SELECT consecutive_missed FROM discipline_log
         WHERE user_id = emp.id AND date < check_date
         ORDER BY date DESC LIMIT 1),
        0
      ) INTO prev_consecutive;

      -- Mark as missed with incremented counter
      INSERT INTO discipline_log (user_id, date, status, consecutive_missed)
      VALUES (emp.id, check_date, 'missed', prev_consecutive + 1)
      ON CONFLICT (user_id, date) DO UPDATE
      SET status = 'missed', consecutive_missed = prev_consecutive + 1;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Storage bucket for cleaning photos
-- ============================================================
INSERT INTO
    storage.buckets (id, name, public)
VALUES (
        'cleaning-photos',
        'cleaning-photos',
        false
    ) ON CONFLICT (id) DO NOTHING;