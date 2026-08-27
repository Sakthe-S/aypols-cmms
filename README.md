# Aypols CMMS - Maintenance & EHS Management System

Factory CMMS, Inventory & EHS management system for Aypols Polymers, Perundurai.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS
- **Backend**: Next.js Server Actions + API Routes
- **Database**: SQLite via Prisma ORM
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
- npm or yarn

### 1. Install Dependencies
```bash
cd "D:\AYPOLS Project\aypols-cmms"
npm install
```

### 2. Initialize Database
```bash
npx prisma db push
```

### 3. Seed Sample Data
```bash
npx tsx prisma/seed.ts
```

### 4. Start Development Server
```bash
npm run dev
```

### 5. Open in Browser
```
http://localhost:3000
```

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@aypols.com | password123 |
| Supervisor | rajesh@aypols.com | password123 |
| Technician | kumar@aypols.com | password123 |
| Store Admin | murugan@aypols.com | password123 |
| EHS Officer | priya@aypols.com | password123 |
| Employee | arun@aypols.com | password123 |

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
│   ├── prisma.ts          # Prisma client singleton
│   ├── auth.ts            # NextAuth configuration
│   └── utils.ts           # Utility functions
├── types/
│   └── next-auth.d.ts     # NextAuth type extensions
└── middleware.ts          # Auth middleware
prisma/
├── schema.prisma          # Database schema
└── seed.ts                # Sample data seeder
```

## Database Schema

Key entities: User, Machine, MaintenanceTicket, SparePart, StockTransaction, TicketSparePart, PmSchedule, AmcRecord, CalibrationRecord, SafetyChecklist, TrainingRecord, Notification
