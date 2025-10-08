# Breakdown Tracker - Maintenance Management System

## Overview

The Breakdown Tracker is an enterprise-grade maintenance management system designed for industrial manufacturing environments. It enables teams to track machine breakdowns, monitor downtime, manage maintenance workflows, and generate analytical reports. The application supports role-based access control with four user levels (admin, supervisor, engineer, viewer) and provides real-time tracking of production line issues across multiple shifts.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- React 18+ with TypeScript for type-safe component development
- Vite as the build tool and development server for fast HMR (Hot Module Replacement)
- Wouter for lightweight client-side routing (alternative to React Router)
- TanStack Query (React Query) for server state management and caching

**UI Component System**
- Shadcn/ui component library built on Radix UI primitives
- Tailwind CSS for utility-first styling with custom design tokens
- Carbon Design System principles for enterprise data-heavy applications
- Dark mode support with theme persistence via localStorage
- Custom color palette based on HSL values for both light and dark themes

**Design Philosophy**
- Information density optimized for industrial use cases
- Clear visual hierarchy with role-based color coding
- Monospace fonts (JetBrains Mono) for numeric data display
- Inter font family for general UI elements

### Backend Architecture

**Server Framework**
- Express.js with TypeScript for RESTful API endpoints
- Session-based authentication using Passport.js with Local Strategy
- PostgreSQL session storage using connect-pg-simple for production persistence
- Middleware for request logging and JSON response capturing

**API Structure**
- RESTful endpoints under `/api` namespace
- Authentication routes: `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`
- Resource routes for breakdowns, lines, sub-lines, machines, problem types, and employees
- Role-based middleware (`isAuthenticated`, `hasRole`) for access control

**Authentication & Authorization**
- Password hashing with bcrypt (10 salt rounds)
- Four-tier role system: admin, supervisor, engineer, viewer
- Session serialization/deserialization with user ID
- Protected routes require authentication, admin-only routes require admin role

### Data Storage

**Database**
- PostgreSQL via Neon serverless driver with WebSocket support
- Drizzle ORM for type-safe database queries and schema management
- UUID-based primary keys generated via `gen_random_uuid()`

**Schema Design**
- `users`: Authentication and user profile data with role field
- `employees`: Maintenance staff information separate from system users
- `lines`: Top-level production lines
- `sub_lines`: Secondary line divisions with foreign key to lines
- `machines`: Equipment inventory linked to lines and sub-lines
- `problem_types`: Categorization for breakdown issues
- `breakdowns`: Core entity tracking downtime incidents with timestamps, status, and relationships

**Database Migrations**
- Drizzle Kit for schema migrations stored in `/migrations` directory
- Push command (`db:push`) for rapid development schema updates

### External Dependencies

**Third-Party Services**
- Neon Database: Serverless PostgreSQL hosting with WebSocket connections
- Google Fonts: Inter and JetBrains Mono font families

**Key NPM Packages**
- `@neondatabase/serverless`: PostgreSQL driver optimized for serverless/edge
- `drizzle-orm`: Type-safe ORM with PostgreSQL dialect
- `bcrypt`: Password hashing for user authentication
- `passport` & `passport-local`: Authentication middleware
- `express-session`: Session management
- `connect-pg-simple`: PostgreSQL session store for persistent sessions
- `@radix-ui/*`: Unstyled accessible component primitives
- `@tanstack/react-query`: Server state management
- `recharts`: Data visualization for analytics charts
- `zod` & `drizzle-zod`: Runtime schema validation
- `date-fns`: Date manipulation utilities

**Development Tools**
- TypeScript with strict mode enabled
- ESBuild for production server bundling
- Vite plugins for Replit integration (cartographer, dev banner, runtime error modal)

**Seeding System**
- Automatic database seeding on server startup
- Master data loaded from JSON file (`attached_assets/masters_seed_1759853208471.json`)
- Default admin account (username: `admin`, password: `admin123`)
- Pre-populated master tables for lines, machines, employees, and problem types

### Application Features

**Core Workflows**
- Breakdown entry with date, shift, line, machine, problem type, and attendee tracking
- Real-time status management (open, closed, pending)
- Downtime calculation and aggregation
- Multi-shift support (A, B, C shifts)
- Excel import/export for bulk data operations

**Analytics & Reporting**
- Dashboard with key metrics (total breakdowns, downtime, status breakdown)
- Shift-wise breakdown analysis with bar charts
- Machine-level downtime rankings
- Trend indicators with period-over-period comparisons

**Master Data Management**
- Admin-controlled CRUD operations for lines, machines, employees, problem types
- Hierarchical line → sub-line → machine relationships
- Employee role and department tracking

**User Management**
- Admin-only user creation and role assignment
- User profile management with email and name fields
- Role badge visual indicators throughout the application