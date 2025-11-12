# Developer Notes

## Application Overview
- Full-stack maintenance management tool split into a React 18 client (`client/`) and an Express + Drizzle backend (`server/`) with shared types in `shared/schema.ts`.
- Authentication is session-based using Passport; the React app gates all non-login routes through `ProtectedRoute` and renders role-aware navigation via `AppSidebar`.
- PostgreSQL is the primary data store. Seed data and maintenance helpers live under `server/`.

## Frontend Feature Summary
- **Auth Shell** - `client/src/App.tsx` wires TanStack Query, Wouter routing, and the global sidebar/layout. `client/src/lib/auth.tsx` fetches `/api/auth/me`, redirects unauthenticated users, and exposes `logout`.
- **Role-Aware Navigation** - `client/src/components/AppSidebar.tsx` renders dashboard, breakdown, reports, maintenance, and admin clusters; maintenance links (monthly/yearly planner) only appear for admin/supervisor roles and expand to month shortcuts.
- **Dashboard Analytics** - `client/src/pages/Dashboard.tsx` + `components/DashboardCharts.tsx` summarise breakdown counts, downtime totals, open issues, and resolved-today metrics, plus Recharts visuals for shift distribution and top downtime machines.
- **Breakdown Tracker** - `client/src/pages/BreakdownTracker.tsx` drives CRUD flows against `/api/breakdowns`. `components/BreakdownForm.tsx` loads master data lookups, calculates downtime, and enforces CAPA details when a High-priority breakdown exceeds 45 minutes before allowing closure.
- **Reports Workspace** - `client/src/pages/Reports.tsx` exports enriched breakdown records (including CAPA JSON payloads) to Excel and accepts Excel uploads (currently processed client-side with status toasts).
- **Maintenance Planner** - `client/src/pages/MaintenancePlanner.tsx` schedules PM jobs with shift validation, plan-year aware date pickers, optional email recipients/templates, and completion triggers that call `/api/maintenance-plans/:id/complete`.
- **Yearly Planner** - `client/src/pages/YearlyPlanner.tsx` normalises legacy plan strings, filters by machine/frequency/plan year, and deep-links into month views. `YearlyPlanMonthView.tsx` provides month grids with plan vs. actual rows, reschedule notes, shift updates, and safeguards against past dates.
- **Master Data Admin** - `client/src/pages/MasterData.tsx` offers tabbed CRUD for lines, sub-lines, machines, employees, and problem types, plus XLSX import/export helpers and local machine-code overrides persisted in `localStorage`.
- **User Management UI** - `client/src/pages/UserManagement.tsx` implements add/delete dialogs tied to `/api/users` endpoints (server support pending).
- **Settings Stub** - `client/src/pages/Settings.tsx` surfaces editable preferences and mock system info for future wiring.

## Backend Feature Summary
- **Auth & Sessions** - `server/auth.ts` configures a PostgreSQL-backed session store, Passport local strategy, and role guard helpers. `server/routes.ts` exposes `/api/auth/login`, `/api/auth/logout`, and `/api/auth/me`.
- **Master Data APIs** - Read endpoints deliver lines, sub-lines, machines, problem types, employees; admin-only mutations exist for employees and problem types. Yearly plan endpoints (`/api/yearly-maintenance-plans`) accept bulk upserts with shift/frequency normalisation.
- **Maintenance Planner APIs** - `/api/maintenance-plans` supports listing, creating (with machine lookups, shift checks, email/template persistence), updating, and marking schedules complete; completion events invoke notification mailers.
- **Breakdown APIs** - `/api/breakdowns` provide full CRUD with joins to lines/machines/problem types/employees and persist extensive CAPA JSON blobs (`shared/schema.ts`).
- **User/Auth Data** - `server/seed.ts` seeds admin/engineer accounts plus baseline lines, sub-lines, machines, problem types, and employees (optionally from `attached_assets/masters_seed_*.json`).
- **Yearly Plan Imports** - `server/scripts/import-yearly-machines.ts` bulk loads machine metadata and plan frequencies from pipe-delimited raw data.
- **Infrastructure Helpers** - `server/ensureTables.ts` guarantees the yearly plan table and maintenance schedule shift column exist; `server/backup-to-sql.ts` produces full SQL dumps with referential ordering.

## Background Jobs & Notifications
- `server/maintenance-scheduler.ts` runs hourly to email upcoming maintenance reminders (1-day lead) and sends completion notifications via `server/email.ts`. SMTP settings fall back to console logging when unset.

## Data Model Highlights
- `shared/schema.ts` defines users, lines/sub-lines, machines (with frequency/plan year), maintenance schedules + yearly plans, employees, problem types, and breakdowns (including CAPA fields). Zod insert schemas underpin request validation (`insertBreakdownSchema`, etc.).

## Known Gaps / Follow-ups
- Backend mutations for `/api/lines`, `/api/sub-lines`, `/api/machines`, and `/api/users` are absent; the React admin pages will surface errors until these routes are added.
- Reports import currently stops at client-side parsing; no persistence workflow exists yet.
- Settings page and several toast confirmations act as UI placeholders without API integration.
- Seed logging strings contain mojibake in `server/seed.ts`; replace with plain ASCII if log readability matters.
