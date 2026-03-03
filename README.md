# Clean Office Discipline System

A production-ready internal web application for employee cleaning documentation and discipline monitoring with photo proof and automated violation tracking.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Deployment**: Vercel

## Features

### Employee

- Submit daily cleaning reports with photo documentation (max 3/day)
- View submission counter (0/3, 1/3, 2/3, 3/3)
- View report history grouped by date
- View discipline status and violation warnings

### Owner

- View all employee reports with filters (date, employee, status)
- View employees who haven't submitted today
- View discipline log with consecutive missed tracking
- Reject reports with optional notes
- Export reports as CSV
- View photos via signed URLs

### Automation

- Daily cron job checks if employees submitted reports
- Tracks consecutive missed days
- Flags violations at 3+ consecutive missed days
- Notification service (WhatsApp/Telegram) ready for integration

## Quick Start

1. Clone and install:

```bash
npm install
```

2. Copy environment file:

```bash
cp .env.local.example .env.local
```

3. Add your Supabase credentials to `.env.local`

4. Run SQL migrations in Supabase SQL Editor:
   - `supabase/migrations/001_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`

5. Start development:

```bash
npm run dev
```

See `docs/` folder for detailed setup guides.

## Architecture

```
src/
├── app/                    # Next.js App Router pages
│   ├── (protected)/        # Authenticated routes
│   │   ├── dashboard/      # Employee dashboard
│   │   ├── history/        # Report history
│   │   └── owner/          # Owner pages
│   ├── api/                # Server-side API routes
│   └── login/              # Login page
├── components/             # React components
│   ├── layout/             # Sidebar, Header, ProtectedLayout
│   └── ui/                 # Toast, Modal, FileUpload, Spinner
├── hooks/                  # Custom hooks (useAuth, useToast, useTheme)
├── lib/                    # Core libraries
│   ├── supabase/           # Supabase client configuration
│   ├── types.ts            # TypeScript types
│   ├── constants.ts        # App constants
│   └── utils.ts            # Utility functions
├── services/               # Business logic services
│   ├── auth.service.ts
│   ├── report.service.ts
│   ├── discipline.service.ts
│   ├── storage.service.ts
│   ├── user.service.ts
│   └── notification.ts     # WhatsApp/Telegram notification
└── middleware.ts            # Auth middleware
```
