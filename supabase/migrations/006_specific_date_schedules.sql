-- ============================================================
-- Migration: Support for specific dates in cleaning schedules
-- ============================================================

-- 1. Make day_of_week nullable
ALTER TABLE cleaning_schedules
ALTER COLUMN day_of_week
DROP NOT NULL;

-- 2. Add scheduled_date column
ALTER TABLE cleaning_schedules
ADD COLUMN IF NOT EXISTS scheduled_date DATE;

-- 3. Ensure either day_of_week OR scheduled_date is provided, but not both at the same time for clarity, or at least one is provided
ALTER TABLE cleaning_schedules
ADD CONSTRAINT check_schedule_type CHECK (
    (
        day_of_week IS NOT NULL
        AND scheduled_date IS NULL
    )
    OR (
        day_of_week IS NULL
        AND scheduled_date IS NOT NULL
    )
);

-- 4. Drop the existing unique constraint (user_id, day_of_week) to replace it with partial unique constraints
ALTER TABLE cleaning_schedules
DROP CONSTRAINT IF EXISTS cleaning_schedules_user_id_day_of_week_key;

-- 5. Add partial unique index for weekly routines
CREATE UNIQUE INDEX IF NOT EXISTS idx_cleaning_schedules_routine ON cleaning_schedules (user_id, day_of_week)
WHERE
    day_of_week IS NOT NULL;

-- 6. Add partial unique index for specific dates
CREATE UNIQUE INDEX IF NOT EXISTS idx_cleaning_schedules_specific ON cleaning_schedules (user_id, scheduled_date)
WHERE
    scheduled_date IS NOT NULL;