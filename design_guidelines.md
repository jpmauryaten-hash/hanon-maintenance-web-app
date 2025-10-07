# Breakdown Tracker Design Guidelines

## Design Approach

**Selected System:** Carbon Design System (IBM) - specifically built for enterprise, data-heavy applications
**Justification:** This breakdown tracker requires efficient data entry, clear information hierarchy, and robust data visualization - Carbon's focus on industrial-strength UI patterns perfectly aligns with operational/maintenance tracking needs.

**Core Principles:**
- Clarity over decoration - every element serves a functional purpose
- Information density without clutter
- Consistent patterns for predictable user experience
- Role-based visual distinction for quick context recognition

---

## Color Palette

### Dark Mode (Primary)
- **Background Base:** 220 15% 12% (neutral-900 equivalent)
- **Background Elevated:** 220 15% 16% (cards, modals, sidebar)
- **Background Accent:** 220 15% 20% (hover states, selected items)
- **Primary Brand:** 210 100% 50% (actions, links, active states)
- **Success:** 142 70% 45% (closed breakdowns, positive metrics)
- **Warning:** 38 92% 50% (pending items, shift B indicator)
- **Critical:** 0 84% 60% (open breakdowns, urgent items)
- **Text Primary:** 0 0% 95%
- **Text Secondary:** 0 0% 70%
- **Border Default:** 220 15% 25%

### Light Mode
- **Background Base:** 0 0% 98%
- **Background Elevated:** 0 0% 100%
- **Background Accent:** 220 20% 95%
- **Primary Brand:** 210 100% 45%
- **Success:** 142 65% 40%
- **Warning:** 38 85% 48%
- **Critical:** 0 75% 55%
- **Text Primary:** 220 20% 15%
- **Text Secondary:** 220 15% 40%
- **Border Default:** 220 15% 85%

---

## Typography

**Font Family:** 
- Primary: 'Inter' (Google Fonts) for UI elements, forms, tables
- Monospace: 'JetBrains Mono' for numeric data, timestamps, IDs

**Scale:**
- Page Headers (h1): text-2xl font-semibold (Admin Dashboard, Breakdown Tracker)
- Section Headers (h2): text-xl font-medium (Today's Breakdowns, Top Machines)
- Card Titles (h3): text-lg font-medium
- Body Text: text-base font-normal
- Labels: text-sm font-medium uppercase tracking-wide
- Helper Text: text-sm text-secondary
- Table Headers: text-xs font-semibold uppercase tracking-wider
- Metrics/KPIs: text-3xl font-bold (total downtime, breakdown count)

---

## Layout System

**Spacing Primitives:** Use Tailwind units of **2, 4, 6, 8, 12, 16** for consistent rhythm
- Component padding: p-4 to p-6
- Section spacing: space-y-6 to space-y-8
- Card margins: gap-6 for grids
- Form field spacing: space-y-4
- Topbar height: h-16
- Sidebar width: w-64 (desktop), full-width drawer (mobile)

**Grid System:**
- Dashboard Cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-4
- Form Layout: 2-column on desktop (grid-cols-2), single on mobile
- Table: full-width with horizontal scroll on mobile

---

## Component Library

### Navigation
**Sidebar:**
- Fixed left panel (w-64) with dark elevated background
- Logo/App name at top (p-6)
- Navigation items with icons (Heroicons) + labels
- Active state: primary color left border (border-l-4) + light background tint
- Role badge below user profile showing current role with role-specific color
- Collapse to icon-only on tablet (md breakpoint)

**Topbar:**
- Fixed top bar (h-16) with background elevated
- Left: Menu toggle (mobile), breadcrumb navigation (desktop)
- Right: Search bar (optional), notifications bell, user dropdown menu
- Divider: border-b with border-default color

### Dashboard Components
**Metric Cards:**
- Background elevated with rounded-lg border
- Large numeric value (text-3xl font-bold) with trending indicator (↑↓ icons)
- Label below (text-sm text-secondary)
- Shift indicators use warning color for B shift, primary for A, success for C
- Padding: p-6

**Charts (Chart.js):**
- Bar chart for shift-wise analysis with shift-specific colors
- Horizontal bar for top 5 machines by downtime
- Doughnut chart for problem type distribution
- Consistent color scheme matching role colors
- Dark/light mode compatible chart configurations
- Card container: bg-elevated, rounded-lg, p-6

### Forms
**Breakdown Entry Form:**
- Two-column layout (desktop): grid grid-cols-2 gap-6
- Form fields with floating labels or top-aligned labels
- Dropdowns (select) with chevron icon, searchable for long lists
- Date/time inputs with calendar picker icons
- Auto-calculated fields (total_minutes) with subtle background difference
- Required field indicators: red asterisk
- Submit button: primary color, full-width on mobile, right-aligned on desktop
- Cancel/Reset: secondary outline button

**Input Styling:**
- Background: slightly lighter than base (matches elevated)
- Border: border-default, focus: primary color ring
- Padding: px-4 py-2.5
- Rounded: rounded-md
- Disabled state: opacity-50 with cursor-not-allowed

### Data Display
**Tables:**
- Striped rows with alternate background (bg-accent on odd)
- Sticky header with background elevated + border-b
- Text-left alignment for text, text-right for numbers
- Status badges: rounded-full px-3 py-1 with role/status colors
- Action buttons: icon-only (edit/delete) with hover tooltip
- Pagination: bottom-right, primary color for active page
- Empty state: centered icon + message in muted text

**Status Badges:**
- Open: Critical color, "Open" text
- Closed: Success color, "Closed" text
- Pending: Warning color, "Pending" text
- Small text (text-xs), font-semibold, uppercase

### Role-Based UI Elements
**Visual Distinction:**
- Admin: Indigo accent (260 85% 60%)
- Supervisor: Blue accent (primary color)
- Engineer: Green accent (success color)
- Viewer: Gray accent (0 0% 50%)

Apply role color to:
- User avatar border
- Role badge background
- Sidebar active state (subtle tint)

### Modals & Overlays
- Overlay: backdrop-blur-sm bg-black/50
- Modal: max-w-2xl, bg-elevated, rounded-xl, shadow-2xl
- Header: border-b, p-6, with close icon (×)
- Content: p-6
- Footer: border-t, p-6, action buttons right-aligned

### Excel Import/Export
**Import Area:**
- Dashed border dropzone (border-dashed border-2)
- File icon + "Drop Excel file or click to browse"
- Progress bar during processing (primary color)
- Success/error states with appropriate icons and colors

**Export Button:**
- Icon + "Export to Excel" label
- Success color for download action
- Loading spinner during generation

---

## Animations

**Minimal, Purposeful Animations:**
- Page transitions: fade-in 150ms
- Dropdown menus: slide-down 100ms with ease-out
- Modal open: scale-95 to scale-100 + fade 200ms
- Button interactions: built-in Tailwind transitions
- Chart animations: Chart.js default (300ms)
- NO parallax, NO scroll-triggered effects, NO decorative animations

---

## Images

**Not Applicable** - This is a data-centric enterprise application with no marketing/hero imagery. Focus on icons (Heroicons), charts (Chart.js), and functional UI elements. Use role-specific colored avatars for user identification.