# Octagram Internal Operations Hub (`hub.octagramai.com`)

A unified, minimalist, and relational authenticated internal operations platform for Octagram employees.

---

## 🌟 Key Modules & Capabilities

1. **Personalized Employee Workspace & Priority Engine**
   - Live urgent priority dashboard surfaces overdue payments, critical revisions, and scheduled calls.
   - Quick one-click task completion, snooze, deadline change, and inline action execution.
   - Shared cross-team tasks synchronized with the central database.

2. **Task Management System**
   - Filterable views (My Tasks, Team Tasks, Overdue, Today, Upcoming, All).
   - Priority levels (`Low`, `Medium`, `High`, `Critical`) and status workflows (`To Do`, `In Progress`, `Blocked`, `Completed`, `Cancelled`).
   - Collaborators, subtasks, recurrence, and interactive comment threads with `@mentions`.

3. **CRM & Multi-File Excel Lead Importer**
   - Kanban Pipeline view (Stages: `NEW`, `CONTACTED`, `ENGAGED`, `QUALIFIED`, `PROPOSAL`, `NEGOTIATION`, `WON`, `LOST`) & structured list view.
   - **Excel / CSV Multi-File Import Engine**: parses spreadsheets, validates columns (matching Octagram lead template), and runs multi-criteria duplicate detection (phone, email, business name, Google Maps URL).
   - **Conflict Resolution**: Choose `Merge`, `Keep Both`, or `Skip` per duplicate.
   - Lead Follow-up scheduler and **Lead-to-Client conversion** preserving historical CRM records.

4. **Dedicated Client Workspaces**
   - Dedicated client portals with persistent navigation.
   - Tabs: `Overview`, `Tasks`, `Meetings`, `Communication Timeline`, `Payments` (Admin only), `Internal Notes`, and `Activity Audit Trail`.
   - Post-meeting action item generator directly creates tasks assigned to team members.

5. **Accounts & Finance (Admin Role Protected)**
   - High-level financial KPIs: `Total Received`, `Total Expected`, `Total Outstanding`, `Total Overdue`, and `Net Balance`.
   - Incoming payment milestone tracking with automated reminder generation.
   - Status automations: marking payment `Paid` auto-completes linked reminder tasks.
   - Outgoing expense ledger for infrastructure, hosting, software seats, and contractors.

6. **Shared Operations Calendar**
   - Month & Agenda views aggregating meetings, task deadlines, lead follow-ups, and payment milestones.

7. **Internal Ticketing System**
   - Formatted ticket numbers (`#1001`, `#1002`, `#1042`).
   - Categories: `Client`, `Technical`, `Internal`, `Sales`, `Administrative`.

8. **Global Search (`Cmd+K`) & Quick Create (`+ Create`)**
   - Universal search with keyboard navigation across Clients, Leads, Tasks, Meetings, Tickets, and Team.
   - Role-aware global create modal.

---

## 🚀 Getting Started

### 1. Installation
```bash
# In the root directory:
npm run install:all
```

### 2. Database Setup & Seeding
```bash
cd server
npx prisma generate
npx prisma db push
npm run seed
```

### 3. Run Development Server
```bash
# Run both Backend API (:5001) and Frontend UI (:5173) concurrently:
npm run dev
```

- Frontend Web App: `http://localhost:5173`
- Backend REST API: `http://localhost:5001/api`
- Healthcheck: `http://localhost:5001/api/health`

---

## 🏗️ Architecture & Subdomain Deployment

- **Subdomain Routing:** `hub.octagramai.com` (Frontend SPA) and `hub.octagramai.com/api` (Backend REST API).
- **Backend:** Node.js, Express, TypeScript, Prisma ORM, JWT authentication with bcryptjs password hashing.
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide React icons, date-fns, SheetJS (xlsx).
- **Database:** Prisma with SQLite (`file:./dev.db`) for zero-daemon local dev; 100% PostgreSQL schema compatible via `.env DATABASE_URL`.
