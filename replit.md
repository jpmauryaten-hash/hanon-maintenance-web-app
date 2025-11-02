# Breakdown Tracker – Maintenance Management System

## Overview
Breakdown Tracker streamlines industrial maintenance operations: logging machine breakdowns, managing master data, scheduling preventive maintenance, and delivering supervisor notifications.

---
## Core Modules
- **Dashboard** – live KPIs (total breakdowns, downtime, top downtime machines).
- **Breakdown Tracker** – rich forms for incidents, CAPA workflow, attachments.
- **Maintenance Planner** – schedule preventive jobs per machine frequency, customize recipients and email templates, mark completions.
- **Master Data** – lines ? sub-lines ? machines (with code & frequency), employees, problem types.
- **Reports** – Excel import/export for breakdowns and master data.
- **User Management** – admin-only creation, role assignment (admin | supervisor | engineer | viewer).

---
## Tech Stack
- **Frontend**: React 18 + TypeScript, Vite, wouter, TanStack Query, shadcn/ui, Tailwind CSS.
- **Backend**: Express + TypeScript, Passport session auth, Drizzle ORM, PostgreSQL (Neon-compatible).
- **Notifications**: Nodemailer (SMTP) for maintenance reminders and completion emails.

---
## Quick Start
```bash
npm install
npm run db:push   # or run SQL migrations manually
npm run dev
```
Default admin credentials: `admin / admin123`

### Environment Variables (`.env`)
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/maintenance
SESSION_SECRET=super-secret
NODE_ENV=development

# Optional SMTP for maintenance emails
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM="Maintenance Tracker <no-reply@example.com>"
MAINTENANCE_NOTIFY_RECIPIENTS=hod@example.com,manager@example.com
```
If SMTP settings are missing, the scheduler logs emails to the console.

---
## Database Notes
Manual SQL if not using Drizzle migrations:
```sql
ALTER TABLE machines ADD COLUMN IF NOT EXISTS maintenance_frequency text;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS code text;
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

---
## Maintenance Notifications
- Hourly scheduler sends day-before reminders for upcoming plans.
- Completion endpoint triggers follow-up email.
- Templates accept placeholders: `{{machineName}}`, `{{machineCode}}`, `{{machineCodeFormatted}}`, `{{lineName}}`, `{{scheduledDate}}`, `{{maintenanceFrequency}}`, `{{notes}}`, `{{completedDate}}`.

---
## Useful Scripts
- `npm run dev` – dev server (API + Vite).
- `npm run check` – TypeScript strict type check.
- `ts-node server/backup-to-sql.ts` – SQL backup generator.

---
## Design Principles
- Dark-mode friendly, high contrast UI for shop-floor environments.
- Monospace typography for numeric accuracy.
- Role badges and permissions baked into UI navigation.

---
## Contact
For access requests or issues, contact the project maintainers at maintenance-support@example.com.
