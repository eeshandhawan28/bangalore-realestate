# PropIQ — Real Estate PM & CRM Platform

> AI-powered project management, CRM, and market intelligence for real estate developers.

PropIQ is a full-stack platform combining construction project management, sales pipeline CRM, market analytics, and an AI copilot — built for Bangalore's real estate market. Developers manage projects and deals; the AI agent answers questions, generates insights, and runs actions across all modules.

---

## Features

### CRM

**Contacts (`/contacts`)**
- Manage leads, clients, contractors, vendors, investors, and government contacts
- Search, filter by type, view full contact detail sheet
- WhatsApp field for India market; custom tags

**Pipeline (`/pipeline`)**
- Visual Kanban board with drag-and-drop deal cards (`@dnd-kit`)
- Customisable stages with win probabilities and colour coding
- Pipeline forecast: total value and weighted expected value in header
- Log activities (notes, calls, meetings) per deal

### Project Management

**Projects (`/projects`)**
- Track construction projects across 7 statuses: Pre-Dev → Planning → Procurement → Construction → Closeout → Completed → On Hold
- Budget progress bar with overbudget alerts
- Filter by status; quick metrics grid per project

**Project Detail (`/projects/[id]`)**
- 5-column task board (To Do / In Progress / Review / Blocked / Done)
- Inline status updates per task; priority badges (Low / Medium / High / Urgent)
- Overdue task highlighting; estimated hours tracking
- Task completion progress bar + budget summary

**My Tasks (`/tasks`)**
- All tasks assigned to the current user, grouped by project
- Smart due-date labels: Overdue / Due Today / Due Tomorrow
- Filter by status, overdue count, and blocked count badges

### Market Intelligence

**Investment Score (`/scores`)**
- Composite 0–100 investability score for 51 Bangalore localities
- **5-component model:**
  - Price Momentum (20%) — 2Y CAGR Q4 2023 → Q4 2025
  - Rental Yield (20%) — net yield normalised 1–4%
  - Sentiment Signal (25%) — LLM-analysed development sentiment
  - Affordability (15%) — entry price vs city average (₹4,890/sqft)
  - Infra Alpha (20%) — live POI proximity via Geoapify
- Grades: **Strong Buy / Buy / Hold / Watch**
- Per-locality breakdown: radar chart, key stats, natural language narrative

**Market Analytics (`/market`)**
- City-level summary: avg ₹/sqft, median 2BHK, total transactions
- Sortable locality rankings, appreciation trends, rental yield table
- Affordability calculator, locality comparison tool

**AI Valuation (`/valuate`)**
- Public, no login required
- AI-estimated price, ±10% confidence range, locality comparison
- Powered by 13,000+ Bangalore transaction records

### AI Copilot

- Floating chat bubble with SSE token streaming
- **Multi-agent supervisor** (LangGraph) routing to 4 specialist agents:
  - **Market agent** — valuation, locality deep-dive, comparison, best locality finder
  - **Portfolio agent** — health scoring, sell recommendations
  - **CRM agent** — search/create contacts, manage deals, log activities, pipeline forecast
  - **PM agent** — list/create projects and tasks, timeline, overdue alerts
- **Intent-aware routing** — regex + LLM intent detection before agent dispatch
- **Groq LLM** (`llama-3.3-70b-versatile`) — fast inference, tool calling
- Inline Recharts charts rendered inside chat bubbles
- Multi-session conversation history with rename/delete

### Other

**Marketplace (`/marketplace`)** — Browse listings with AI fair-value badges

**RERA Checker (`/rera`)** — Fuzzy search across RERA Karnataka registered projects

**Portfolio (`/portfolio`)** — Track owned properties with automatic AI valuation

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript |
| Styling | Tailwind CSS, shadcn/ui |
| Charts | Recharts |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable |
| Dates | date-fns |
| Auth + DB | Supabase (PostgreSQL + Auth + RLS) |
| Multi-tenancy | Organizations + org_members RLS policies |
| AI / LLM | Groq (`llama-3.3-70b-versatile`) |
| Agent Framework | LangGraph supervisor + LangChain tools + Zod schemas |
| POI Data | Geoapify Places API |
| Search | fuse.js (RERA fuzzy search) |
| Themes | next-themes (dark/light mode) |
| Fonts | Clash Display + Satoshi (Fontshare) |

---

## Getting Started

### Prerequisites
- Node.js 18+
- Supabase project
- Groq API key (free — [console.groq.com](https://console.groq.com))
- Geoapify API key (free tier — 3,000 req/day)

### Installation

```bash
git clone https://github.com/eeshandhawan/bangalore-realestate.git
cd bangalore-realestate/propiq
npm install
```

### Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GROQ_API_KEY=your_groq_key
GEOAPIFY_API_KEY=your_geoapify_key
CRON_SECRET=your_cron_secret
```

### Supabase Setup

Run all migration files in order from `supabase/migrations/`:

1. `001_organizations.sql` — multi-tenancy, org_members, RLS
2. `002_crm_tables.sql` — contacts, pipelines, pipeline_stages, deals, deal_activities
3. `003_pm_tables.sql` — projects, tasks, task_comments, notifications
4. `004_budget_documents.sql` — budget_categories, expenses, documents, templates, workflows

Also run the base sentiment/POI tables:

```sql
create table locality_sentiment (
  locality_name text primary key,
  sentiment_score float not null default 0,
  trend text not null default 'stable',
  highlights jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

create table locality_poi (
  locality_name    text primary key,
  schools          int not null default 0,
  hospitals        int not null default 0,
  malls            int not null default 0,
  parks            int not null default 0,
  offices          int not null default 0,
  metro_distance_m int not null default 9999,
  special_infra    jsonb not null default '[]',
  updated_at       timestamptz not null default now()
);

alter table locality_sentiment enable row level security;
alter table locality_poi enable row level security;
create policy "public read" on locality_sentiment for select using (true);
create policy "public read" on locality_poi for select using (true);
```

**Fix for RLS recursion on org_members** (run after 001):

```sql
drop policy if exists "org_members_can_view_members" on org_members;
drop policy if exists "org_owners_can_manage_members" on org_members;

create policy "users_can_view_own_membership"
  on org_members for select using (user_id = auth.uid());

create or replace function is_org_owner_or_manager(org_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from org_members
    where organization_id = org_id
      and user_id = auth.uid()
      and role in ('owner', 'manager')
  );
$$;

create policy "org_owners_can_manage_members"
  on org_members for all using (is_org_owner_or_manager(organization_id));
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Seed Demo Data

Sign in, then visit `/seed` and click **Seed Demo Data**. This creates:
- An organisation for your account
- 8 contacts (leads, clients, contractors, vendors, investors, government)
- A Sales Pipeline with 5 stages + 6 demo deals
- 2 construction projects with 13 tasks assigned to you

---

## Project Structure

```
propiq/
├── app/
│   ├── (auth)/                         # Login / signup
│   ├── (dashboard)/
│   │   ├── contacts/                   # Contact list + detail sheet + create modal
│   │   ├── pipeline/                   # Kanban deal board (dnd-kit)
│   │   ├── projects/                   # Project list + [id] task board
│   │   ├── tasks/                      # My Tasks — assigned to current user
│   │   ├── portfolio/                  # Property portfolio
│   │   ├── market/                     # Market analytics
│   │   ├── marketplace/                # Listing browser
│   │   ├── rera/                       # RERA project checker
│   │   └── scores/                     # Investment Score leaderboard
│   ├── api/
│   │   ├── chat/route.ts               # AI Copilot — SSE + LangGraph multi-agent
│   │   └── cron/
│   │       ├── sentiment-refresh/      # Weekly LLM sentiment pipeline
│   │       └── poi-refresh/            # Geoapify POI data refresh
│   ├── seed/                           # Demo data seeder
│   └── valuate/                        # AI valuation (public)
├── components/
│   ├── chat/                           # ChatBubble, ChatMessage
│   ├── shared/                         # Sidebar, BottomNav, ThemeToggle
│   └── ui/                             # shadcn/ui components
└── lib/
    ├── agents/
    │   ├── supervisor.ts               # LangGraph multi-agent supervisor
    │   ├── state.ts                    # Shared agent state
    │   └── tools/                      # market, portfolio, crm, pm tool sets
    ├── auth/
    │   └── middleware.ts               # Org context resolver
    ├── hooks/
    │   └── useOrgContext.ts            # orgId + userId hook
    ├── scores.ts                       # Investment Score engine
    ├── valuation.ts                    # AI valuation logic
    └── data/                           # Static JSON datasets (51 localities)
```

---

## Design System

- **Primary:** Deep forest green `#1a5c3a`
- **Surfaces:** Warm beige `#f7f6f2` / `#f9f8f5`
- **Semantic:** Red = overdue/blocked/overpriced, Green = done/fair value, Amber = warning/hold
- **Dark mode:** Full support via `next-themes`
- **Navigation:** 240px sidebar (desktop) + 5-item bottom tab bar (mobile)

---

## Roadmap

### Completed
- [x] AI valuation engine (13,000+ transaction records)
- [x] Portfolio tracking with Supabase
- [x] Market analytics — 51 localities, Q4 2025 data
- [x] Marketplace with AI fair-value badges
- [x] RERA checker with fuzzy search
- [x] Investment Score — 5-component composite
- [x] Geoapify POI integration
- [x] AI Copilot — migrated to Groq, LangGraph multi-agent supervisor
- [x] Multi-session conversation history
- [x] CRM — Contacts + Pipeline Kanban with drag-and-drop
- [x] PM — Projects + Task board + My Tasks
- [x] Multi-tenancy (organizations + RLS)

### Next
- [ ] Phase 2: Speech/text-to-project templates (Whisper + LLM generation)
- [ ] Phase 3: Hindi/Kannada language support (next-intl), budget tracking, document management
- [ ] Phase 4: Tier enforcement (Free/Pro/Enterprise), RBAC, unified dashboard
- [ ] Phase 5: Enterprise SSO, REST API, white-labelling

---

## Dataset

Primary: [Bengaluru House Price Data — Kaggle](https://www.kaggle.com/datasets/amitabhajoy/bengaluru-house-price-data) (13,320 rows, 241 localities)

Enriched with manually curated quarterly price indices, rental yields, development sentiment, and Geoapify live POI data for 51 core localities.

---

## License

MIT
