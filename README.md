# Breakdown Tracker – Maintenance Management System

An enterprise-focused maintenance platform for manufacturing teams. It tracks machine breakdowns, manages master data, schedules preventive maintenance, and keeps supervisors informed through email notifications.

---
## Key Features
- **Breakdown Tracking** – capture date, shift, line, machine, attendees, CAPA fields, and downtime per incident.
- **Maintenance Planner** – schedule preventive maintenance with machine-aware frequencies, custom email recipients, and editable templates.
- **Bulk Operations** – import/export master data and maintenance schedules via Excel.
- **Analytics Dashboard** – real-time overview of breakdown counts, downtime, and top downtime machines.
- **Master Data Management** – hierarchical CRUD for lines → sub-lines → machines (with maintenance frequency & code fields).
- **Role-Based Access** – admin, supervisor, engineer, viewer with gated routes and UI controls.

---
## Tech Stack
- **Frontend**: React 18 + TypeScript, Vite, wouter (routing), TanStack Query, shadcn/ui, Tailwind CSS.
- **Backend**: Express + TypeScript, Passport.js (session auth), PostgreSQL via Drizzle ORM.
- **Notifications**: Nodemailer (SMTP) with customizable templates.
- **Tooling**: TypeScript strict mode, ESLint (via tsc), Recharts, date-fns.

---
## Getting Started
### Prerequisites
- Node.js 18+
- PostgreSQL 13+ (or Neon serverless connection string)
- pnpm/npm/yarn (examples use `npm`)

### Environment Variables
Create `.env` in project root:
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/maintenance
SESSION_SECRET=your-session-secret
NODE_ENV=development

# Optional SMTP settings for maintenance notifications
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=Maintenance Tracker <no-reply@example.com>
MAINTENANCE_NOTIFY_RECIPIENTS=hod@example.com,manager@example.com,supervisor@example.com
```
> If SMTP variables are omitted, emails are logged to the console for development.

### Setup Commands
```bash
npm install
npm run db:push   # apply Drizzle schema (requires drizzle.config.ts)
```
If you do not use `db:push`, run the raw SQL:
```sql
ALTER TABLE machines
  ADD COLUMN IF NOT EXISTS maintenance_frequency text,
  ADD COLUMN IF NOT EXISTS code text;

CREATE TABLE IF NOT EXISTS maintenance_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id varchar NOT NULL REFERENCES machines(id),
  scheduled_date date NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  maintenance_frequency text,
  notes text,
  email_recipients text,
  email_template text,
  pre_notification_sent boolean DEFAULT false,
  created_by_id varchar REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);
```

### Running Locally
```bash
npm run dev    # starts API + Vite dev server
```
Default admin credentials (seeded on first run):
- Username: `admin`
- Password: `admin123`

### Type Checking
```bash
npm run check  # strict TypeScript validation
```

---
## Maintenance Scheduler
- Hourly job (`startMaintenanceScheduler`) scans `maintenance_schedules` for plans due tomorrow and sends reminders.
- Completion endpoint triggers post-maintenance email.
- Emails support placeholders: `{{machineName}}`, `{{machineCode}}`, `{{machineCodeFormatted}}`, `{{lineName}}`, `{{scheduledDate}}`, `{{maintenanceFrequency}}`, `{{notes}}`, `{{completedDate}}`.

---
## Project Structure
```
client/   # React TS frontend
server/   # Express API + auth, scheduler, backup utility
shared/   # Drizzle schema & shared types
migrations/ (optional) # drizzle migrations
```

---
## Backup Utility
```
ts-node server/backup-to-sql.ts
```
Generates `database-backup-YYYY-MM-DD.sql` with INSERT statements for all tables.

---
## Contributing
1. Branch from `main`
2. Run `npm run check` before committing
3. Ensure migrations/backups are updated when schema changes

---
## License
This project is proprietary to the client. Redistribution is not permitted without consent.
