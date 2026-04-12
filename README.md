# PropIQ — Bangalore Real Estate Intelligence Platform

> AI-powered investment scoring, portfolio analytics, and market intelligence for Bangalore real estate.

PropIQ combines a data-driven Investment Score engine, an AI Portfolio Copilot, real-time POI proximity scoring, and a live sentiment pipeline — all built for Bangalore's 51 core localities.

---

## Features

### Investment Score (`/scores`)
- Composite 0–100 investability score for 51 Bangalore localities
- **5-component scoring model** (total = 100%):
  - Price Momentum (20%) — 2Y CAGR from Q4 2023 → Q4 2025
  - Rental Yield (20%) — net yield normalised 1–4%
  - Sentiment Signal (25%) — LLM-analysed development sentiment + trend bonus
  - Affordability (15%) — entry price vs city average (₹4,890/sqft)
  - Infra Alpha (20%) — POI proximity scoring via live Geoapify data
- Grades: **Strong Buy / Buy / Hold / Watch**
- Per-locality breakdown sheet: radar chart, natural language narrative, key stats, score bar chart
- **"What's Nearby" card** — real POI counts (schools, hospitals, malls, parks, offices within 3km), metro distance with colour coding, direct link to nearest Namma Metro station on Google Maps
- Sortable leaderboard by any component

### Portfolio Copilot (AI Chat)
- Floating chat bubble powered by `Qwen/Qwen2.5-7B-Instruct` via HuggingFace Inference API
- True token-by-token streaming (SSE)
- **Intent-aware routing** — detects portfolio / market / deal queries and prepends focused system prompts
- **5 agent tools:**
  - `get_portfolio_health` — scores portfolio across diversification, yield, appreciation, liquidity (0–100 each)
  - `get_sell_recommendation` — HOLD / CONSIDER SELLING per property based on gain %, yield, sentiment trend
  - `get_locality_deep_dive` — full locality profile: price history, rental yield, sentiment, investment score
  - `compare_localities` — side-by-side comparison of 2–3 localities with winner recommendation
  - `evaluate_deal` — GOOD DEAL / FAIR / OVERPRICED verdict given locality + sqft + asking price
- **Inline Recharts charts** — bar, line, and grouped bar charts rendered inside chat bubbles
- **Multi-session conversation history** — localStorage persistence keyed by Supabase user ID, up to 20 sessions
- Session management: new chat, history panel, rename, delete
- Markdown rendering via `react-markdown`

### Portfolio Dashboard (`/portfolio`)
- Track all properties with automatic AI valuation on save
- Summary bar: total value, total invested, overall return (₹ and %)
- Property detail drawer with value-over-time chart and estimated rental yield
- Supabase PostgreSQL backend

### Market Analytics (`/market`)
- City-level summary: avg ₹/sqft, median 2BHK, total transactions
- Sortable locality rankings (51 localities), appreciation trends, rental yield table
- Affordability calculator, locality comparison tool
- Static dataset of 51 localities — Q1 2022 → Q4 2025 price history

### AI Valuation Engine (`/valuate`)
- Public tool — no login required
- Enter location, sqft, BHK, bathrooms, balconies
- AI-estimated price, ±10% confidence range, price/sqft, locality comparison
- Powered by 13,000+ Bangalore property transaction records

### Marketplace (`/marketplace`)
- Browse listings with AI fair value badges (FairPriceBadge — green/red)
- Filter by type (sale/rent), BHK, sort by newest/price/best value
- List properties from your portfolio via Copilot (`create_listing` tool)

### RERA Checker (`/rera`)
- Fuzzy search across RERA-registered Karnataka projects
- Verify developer, registration number, date, status, unit count
- Links to official RERA Karnataka portal

---

## Data Infrastructure

| File | Contents |
|------|----------|
| `lib/data/market_stats.json` | 51 localities — avg ₹/sqft, BHK medians, listing counts |
| `lib/data/locality_price_history.json` | Quarterly price index Q1 2022 → Q4 2025 (13 periods) |
| `lib/data/locality_rental_yields.json` | Net yield, gross yield, 5Y/1Y appreciation, rental demand |
| `lib/data/locality_sentiment.json` | LLM sentiment score (−0.15 to +0.15), trend, highlights |
| `lib/data/locality_poi.json` | POI counts (schools/hospitals/malls/parks/offices), metro distance, nearest metro station name |
| `lib/data/locality_coordinates.json` | Lat/lng for all 51 localities |
| `lib/data/rera_projects.json` | RERA-registered Karnataka projects |

### Live Data Pipelines (Supabase + Cron)

**Sentiment Refresh** (`/api/cron/sentiment-refresh`)
- Runs weekly via Vercel cron
- Fetches latest development news per locality, runs LLM sentiment analysis via HuggingFace
- Upserts to `locality_sentiment` Supabase table

**POI Refresh** (`/api/cron/poi-refresh`)
- Fetches live POI counts from **Geoapify Places API** for all 51 localities
- Categories: schools, hospitals, shopping malls, parks, offices (3km radius)
- Nearest metro station distance (10km search radius)
- Falls back to seeded `locality_poi.json` if API key unavailable
- Upserts to `locality_poi` Supabase table

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript |
| Styling | Tailwind CSS, shadcn/ui, `@tailwindcss/typography` |
| Charts | Recharts (radar, bar, line, grouped bar) |
| Markdown | react-markdown |
| Auth + DB | Supabase (PostgreSQL + Auth) |
| AI / LLM | HuggingFace Inference API (`Qwen/Qwen2.5-7B-Instruct`) |
| Agent Framework | LangChain `DynamicStructuredTool` + Zod schemas |
| POI Data | Geoapify Places API |
| Search | fuse.js (RERA fuzzy search) |
| Themes | next-themes (dark/light mode) |
| Fonts | Clash Display + Satoshi (Fontshare) |

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm
- Supabase project
- HuggingFace API key (free)
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
HUGGINGFACE_API_KEY=your_hf_key
GEOAPIFY_API_KEY=your_geoapify_key
CRON_SECRET=your_cron_secret
```

### Supabase Setup

Run in your Supabase SQL editor:

```sql
-- Sentiment table
create table locality_sentiment (
  locality_name text primary key,
  sentiment_score float not null default 0,
  trend text not null default 'stable',
  highlights jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

-- POI table
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
create policy "service role write" on locality_sentiment for all using (true) with check (true);
create policy "service role write" on locality_poi for all using (true) with check (true);
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Seed Live Data

```bash
# Populate POI data (runs Geoapify for all 51 localities — ~2 min)
curl -X POST http://localhost:3000/api/cron/poi-refresh \
  -H "x-cron-secret: your_cron_secret"

# Populate sentiment data
curl -X POST http://localhost:3000/api/cron/sentiment-refresh \
  -H "x-cron-secret: your_cron_secret"
```

---

## Project Structure

```
propiq/
├── app/
│   ├── (auth)/                         # Login / signup (Supabase Auth)
│   ├── (dashboard)/
│   │   ├── portfolio/                  # Portfolio management
│   │   ├── market/                     # Market analytics + comparison tools
│   │   ├── marketplace/                # Browse + list properties
│   │   ├── rera/                       # RERA project checker
│   │   └── scores/                     # Investment Score leaderboard + breakdown
│   ├── api/
│   │   ├── chat/route.ts               # Portfolio Copilot — SSE streaming + ReAct tool loop
│   │   └── cron/
│   │       ├── sentiment-refresh/      # Weekly LLM sentiment pipeline
│   │       └── poi-refresh/            # Geoapify POI data refresh
│   └── valuate/                        # AI valuation (public, no login)
├── components/
│   ├── chat/
│   │   ├── ChatBubble.tsx              # Multi-session chat UI with history panel
│   │   └── ChatMessage.tsx             # Markdown + inline Recharts charts
│   ├── portfolio/                      # PropertyCard, AddPropertyModal
│   ├── valuation/                      # ValuationForm, ValuationResult
│   ├── market/                         # LocalityRankingTable, AppreciationTrendsChart, etc.
│   ├── marketplace/                    # ListingCard, ListingFilters, FairPriceBadge
│   ├── rera/                           # ReraResultCard
│   └── shared/                         # Sidebar, BottomNav, ThemeToggle
└── lib/
    ├── scores.ts                       # Investment Score engine (5-component composite)
    ├── valuation.ts                    # AI valuation logic
    ├── agent/
    │   └── tools.ts                    # LangChain agent tools (12 total)
    └── data/                           # Static JSON datasets (51 localities)
```

---

## Design System

- **Primary:** Deep forest green `#1a5c3a` (trust + wealth)
- **Surfaces:** Warm beige `#f7f6f2` / `#f9f8f5`
- **Semantic:** Red = overpriced / Watch, Green = fair / Strong Buy, Amber = Hold
- **Dark mode:** Full support via `next-themes`
- **Navigation:** 240px sidebar (desktop) + bottom tab bar (mobile)

---

## Roadmap

### Completed
- [x] AI valuation engine (13,000+ transaction records)
- [x] Portfolio tracking with Supabase
- [x] Market analytics — 51 localities, Q4 2025 data
- [x] Marketplace with FairPriceBadge
- [x] RERA checker with fuzzy search
- [x] Investment Score — 5-component composite for 51 localities
- [x] Geoapify POI integration — live infrastructure scoring
- [x] Portfolio Copilot — streaming AI agent with 12 tools
- [x] Multi-session conversation history
- [x] Weekly sentiment pipeline (HuggingFace + Supabase)
- [x] Live POI refresh cron (Geoapify Places API)

### Next
- [ ] Real listing inventory (Propstack API or partner feed)
- [ ] Price alert notifications
- [ ] Multi-city support (Mumbai, Pune, Hyderabad)

---

## Dataset

Primary: [Bengaluru House Price Data — Kaggle](https://www.kaggle.com/datasets/amitabhajoy/bengaluru-house-price-data) (13,320 rows, 241 localities)

Enriched with manually curated quarterly price indices, rental yields, development sentiment, and Geoapify live POI data for 51 core localities.

---

## License

MIT
