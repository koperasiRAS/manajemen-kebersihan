# Local Development Guide

## Prerequisites

- Node.js 18+ installed
- npm installed
- Supabase project created (see `SETUP.md`)

## Setup

### 1. Install dependencies

```bash
cd clean-office-discipline
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

### 3. Run database migrations

Go to your Supabase SQL Editor and run:

1. `supabase/migrations/001_schema.sql`
2. `supabase/migrations/002_rls_policies.sql`

### 4. Create test users

In Supabase Dashboard:

1. Create auth users in **Authentication > Users**
2. Insert into `users` table via SQL Editor (see `SETUP.md`)

### 5. Start development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Common Tasks

### Build for production

```bash
npm run build
```

### Run linting

```bash
npm run lint
```

### Test the daily discipline function

You can manually trigger the discipline check by calling the Edge Function:

```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/daily-discipline-check \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

## Troubleshooting

### "Unauthorized" on login

- Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are correct
- Check that the user exists in both `auth.users` and `public.users` tables

### Photos not uploading

- Verify the `cleaning-photos` storage bucket exists
- Check RLS policies on `storage.objects` are applied

### Reports not showing

- Verify RLS policies are enabled and applied on `cleaning_reports`
- Check that `user_id` matches the authenticated user's ID
