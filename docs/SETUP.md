# Supabase Setup Guide

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your **Project URL** and **Anon Key** from Settings > API
3. Note your **Service Role Key** (for Edge Functions)

## 2. Run Database Migrations

Go to **SQL Editor** in your Supabase dashboard and run these files in order:

### Step 1: Schema

Copy and paste the contents of `supabase/migrations/001_schema.sql` and execute.

This creates:

- `users` table
- `cleaning_reports` table
- `discipline_log` table
- Trigger for daily report limit (max 3)
- Function for daily discipline check
- Storage bucket `cleaning-photos`

### Step 2: RLS Policies

Copy and paste the contents of `supabase/migrations/002_rls_policies.sql` and execute.

This sets up Row Level Security for all tables and storage.

## 3. Create Users

### Create Owner Account

1. Go to **Authentication > Users**
2. Click **Add User** > **Create New User**
3. Enter email and password
4. After creation, go to **SQL Editor** and run:

```sql
INSERT INTO users (id, name, role)
VALUES (
  'PASTE_AUTH_USER_UUID_HERE',
  'Owner Name',
  'owner'
);
```

### Create Employee Accounts

Repeat for each employee:

1. **Authentication > Users > Add User**
2. Then in **SQL Editor**:

```sql
INSERT INTO users (id, name, role, phone_number)
VALUES (
  'PASTE_AUTH_USER_UUID_HERE',
  'Employee Name',
  'employee',
  '+628xxxxx'  -- optional, for notifications
);
```

## 4. Storage Bucket Setup

The migration script creates the bucket automatically. Verify:

1. Go to **Storage**
2. Confirm `cleaning-photos` bucket exists
3. It should be set to **private** (not public)

## 5. Edge Function Setup (Daily Cron)

### Deploy the Edge Function

```bash
npx supabase functions deploy daily-discipline-check
```

### Setup Cron Schedule

1. Enable **pg_cron** extension: Database > Extensions > search "pg_cron" > enable
2. Enable **pg_net** extension: Database > Extensions > search "pg_net" > enable
3. Run in SQL Editor:

```sql
SELECT cron.schedule(
  'daily-discipline-check',
  '5 17 * * *',  -- 00:05 WIB (UTC+7) = 17:05 UTC previous day
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/daily-discipline-check',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Replace `YOUR_PROJECT_REF` and `YOUR_SERVICE_ROLE_KEY` with your actual values.

## 6. Environment Variables

Create `.env.local` in the project root:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...

# Optional: Notification
NOTIFICATION_PROVIDER=telegram
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id
```
