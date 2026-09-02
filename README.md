# Aypols CMMS - Maintenance & EHS Management System

Factory CMMS, Inventory & EHS management system for Aypols Polymers, Perundurai.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS
- **Backend**: Next.js Server Actions + API Routes
- **Database**: PostgreSQL via `pg` (node-postgres)
- **Auth**: NextAuth.js (Credentials Provider)
- **Icons**: Lucide React

## Features

### Phase 1 (In Scope)
- **Dashboard** - Open/closed tickets, upcoming PMs, low-stock alerts, cost summaries
- **Maintenance Ticketing** - Raise, allocate, work timer, parts usage, verification, closure
- **Spare Parts Inventory** - Part master, stock in/out, low-stock alerts, transaction ledger
- **Machine/Asset Register** - Machine profiles, lifetime maintenance cost, service history
- **PM/AMC/Calibration Scheduling** - Automated reminders, completion logs
- **EHS** - Safety checklists (safety gate), training tracking, health compliance
- **Reports** - Machine-wise cost, technician performance, part consumption, ticket analytics
- **Notifications** - In-app alerts for low stock, PM reminders, escalations

## Setup Instructions

### Prerequisites
- Node.js 18+ installed
- PostgreSQL running locally (default `localhost:5432`)
- npm or yarn

### 1. Install Dependencies
```bash
cd "D:\AYPOLS Project\aypols-cmms"
npm install
```

### 2. Configure Database
Create an `aypols` database and set `DATABASE_URL` in `.env` (use your own password;
the value below is a placeholder):
```
DATABASE_URL="postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/aypols"
```

> **Security note:** Do not commit real database credentials to this repository.
> If a real password has ever been committed or exposed here, rotate it on the
> actual database and update `.env` (which is git-ignored).

### 3. Apply Migrations
Apply all migration files in `migrations/` in numeric order. These are idempotent -
safe to run multiple times. `0006_baseline_schema.sql` captures the full current
schema, so a fresh environment can start from there; the earlier files apply the
incremental additions.
```bash
psql -d aypols -f migrations/0001_whatsapp_notifications.sql
psql -d aypols -f migrations/0002_app_config.sql
psql -d aypols -f migrations/0003_features.sql
psql -d aypols -f migrations/0004_ticket_photos.sql
psql -d aypols -f migrations/0005_spare_parts_hsn_sale.sql
psql -d aypols -f migrations/0006_baseline_schema.sql
```

### 4. Configure Twilio WhatsApp (optional, for WhatsApp notifications)
Create a Twilio account, get a WhatsApp-enabled sender, then add to `.env`:
```
TWILIO_ACCOUNT_SID="your_account_sid"
TWILIO_AUTH_TOKEN="your_auth_token"
TWILIO_WHATSAPP_FROM="whatsapp:+14155238886"
```
Numbers are sent as-is; 10-digit numbers are prefixed with `91` (India).
In Settings -> Notification Preferences, enable WhatsApp and optionally set per-type
preferences, then use "Send Test WhatsApp" to verify delivery.

### 5. Seed Sample Data
```bash
npm run db:seed
```

### 6. Start Development Server
```bash
npm run dev
```

### 7. Open in Browser
```
http://localhost:3000
```

### 8. Schedule Reminders (optional but recommended)
Reminder generation (upcoming PM/AMC/calibration/training, low-stock alerts) and
WhatsApp delivery run through a **scheduled job**, not just when someone loads the
dashboard. Expose an endpoint that a scheduler can hit headlessly:

1. Set a shared secret in `.env`:
   ```
   CRON_SECRET="a-long-random-secret"
   ```
2. Point your scheduler (Vercel Cron, GitHub Actions, Windows Task Scheduler,
   crontab, etc.) at:
   ```bash
   curl -X POST https://<your-host>/api/scheduled/run -H "x-cron-secret: $CRON_SECRET"
   ```
   e.g. every morning:
   ```cron
   0 7 * * *  curl -X POST https://<host>/api/scheduled/run -H "x-cron-secret: $CRON_SECRET"
   ```

Without a `CRON_SECRET` set, the same endpoint still runs when called by any
authenticated user (fallback for in-app/manual triggering). The dashboard also
generates reminders on load as a redundancy.

## Demo Credentials

Demo logins (the same roles below) are created by the database seed with the password
`password123` **for local development only**. On the login page, these demo credentials
are shown only when running outside of production (`NODE_ENV !== 'production'`).

| Role | Email (dev seed) |
|------|------------------|
| Admin | admin@aypols.com |
| Supervisor | venkatesh@aypols.com |
| Technician | stephan@aypols.com |
| Technician | nagaraj@aypols.com |
| Technician | sathiesh@aypols.com |
| Store Admin | murugan@aypols.com |
| EHS Officer | priya@aypols.com |
| Employee | arun@aypols.com |

> **Security note:** These are development-only credentials. Before any client demo,
> UAT, or production deployment, change every seed user's password to a strong,
> unique value and never reuse the shared `password123`. New users created via
> Settings now require an explicit password (no silent default).

## Seeded Data (Actual Plant Data)

The database is seeded with real data from the Aypols plant:

- **136 machines/equipment** (from Machinery Biodata - APPL asset codes, departments, locations, manufacturers, installation years; includes all main equipment plus 3 forklifts, 4 dock levelers, and 6 kitchen machines)
- **141 spare parts** (from Store Stock - actual part names, HSN, units, purchase rates, opening quantities)
- **756 preventive maintenance schedules** (from PM checklists - daily/weekly/monthly/quarterly/half-yearly/annual tasks per machine with inspection checklist items)
- **14 maintenance tickets** (from actual daily report work)
- **17 training programs** (from the annual Training Calendar)
- **19 statutory approvals** (EHS Health & Legal Compliance - Hazardous Waste Authorization, Pollution Consent for Air/Water, Environmental Clearance, Fire Service & Explosive Licenses, Factory License, FSSAI, lease deeds and utility approvals from PCB, SIPCOT, TNEB, etc., with validity and renewal lead times)
- **Safety checklists** based on the ISO 14001/45001 Work Permit

> Note: Re-running `npm run db:seed` truncates and reloads all seed tables, so it is safe to re-run after schema changes.

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── dashboard/     # Main dashboard with KPIs
│   │   ├── tickets/       # Maintenance ticketing
│   │   ├── machines/      # Machine/asset register
│   │   ├── inventory/     # Spare parts inventory (+ edit)
│   │   ├── pm/            # PM, AMC, calibration
│   │   ├── ehs/           # Safety checklists, training
│   │   ├── reports/       # Reports & analytics
│   │   ├── notifications/ # In-app notifications
│   │   └── settings/      # Settings, user & config management
│   ├── api/               # API routes (auth-protected)
│   ├── login/             # Login page
│   └── layout.tsx         # Root layout
├── components/
│   ├── ViewToggle.tsx     # List/card view toggle
│   └── ConfirmForm.tsx    # Inline confirm wrapper
├── lib/
│   ├── db.ts              # pg connection pool + query helpers
│   ├── auth.ts            # NextAuth configuration
│   ├── roles.ts           # Shared role constants + role checks
│   ├── whatsapp.ts        # Twilio WhatsApp delivery
│   ├── ticketPhotos.ts    # Ticket photo upload/delete helpers
│   └── utils.ts           # Utility functions
├── types/
│   └── next-auth.d.ts     # NextAuth type extensions
└── middleware.ts          # Auth middleware (pages + API)
migrations/                # SQL migrations (baseline + incremental)
prisma/
└── seed.ts                # Sample data seeder (uses pg directly)
```

## Database Schema

PostgreSQL. Key tables: `users`, `app_config`, `machines`, `maintenance_tickets`,
`spare_parts` (includes `hsn_sac` and `sale_rate`), `stock_transactions`,
`ticket_spare_parts`, `ticket_progress_logs`, `pm_schedules`, `amc_records`,
`calibration_records`, `safety_checklists`, `safety_checklist_completions`,
`training_records`, `health_compliance_records`, `notification_preferences`,
`notifications`, `compliance_override_history`.

The full schema is captured in `migrations/0006_baseline_schema.sql`.
