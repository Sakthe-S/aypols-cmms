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
Create a `aypols` database and set `DATABASE_URL` in `.env`:
```
DATABASE_URL="postgresql://postgres:sakthe123@localhost:5432/aypols"
```

### 3. Apply Whatsapp Migration
Adds WhatsApp delivery columns, the `notification_preferences` table, and the per-user
opt-in flag. Idempotent - safe to run multiple times.
```bash
psql -d aypols -f migrations/0001_whatsapp_notifications.sql
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

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@aypols.com | password123 |
| Supervisor | venkatesh@aypols.com | password123 |
| Technician | stephan@aypols.com | password123 |
| Technician | nagaraj@aypols.com | password123 |
| Technician | sathiesh@aypols.com | password123 |
| Store Admin | murugan@aypols.com | password123 |
| EHS Officer | priya@aypols.com | password123 |
| Employee | arun@aypols.com | password123 |

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
│   │   ├── inventory/     # Spare parts inventory
│   │   ├── pm/            # PM, AMC, calibration
│   │   ├── ehs/           # Safety checklists, training
│   │   ├── reports/       # Reports & analytics
│   │   └── notifications/ # In-app notifications
│   ├── api/               # API routes
│   ├── login/             # Login page
│   └── layout.tsx         # Root layout
├── components/
│   └── Sidebar.tsx        # Navigation sidebar
├── lib/
│   ├── db.ts              # pg connection pool + query helpers
│   ├── auth.ts            # NextAuth configuration
│   └── utils.ts           # Utility functions
├── types/
│   └── next-auth.d.ts     # NextAuth type extensions
└── middleware.ts          # Auth middleware
prisma/
└── seed.ts                # Sample data seeder (uses pg)
```

## Database Schema

Key entities: User, Machine, MaintenanceTicket, SparePart, StockTransaction, TicketSparePart, PmSchedule, AmcRecord, CalibrationRecord, SafetyChecklist, TrainingRecord, Notification
