# PropIQ — Bangalore Real Estate Intelligence Platform

> AI-powered property valuation, portfolio tracking, and market analytics for Bangalore real estate.

PropIQ combines wealth tracking (like Groww for properties) with an AI valuation engine, Bangalore market intelligence, a transparent P2P marketplace, and RERA verification — all in one app. Every listing shows an AI-generated "fair value estimate," turning opaque pricing into transparent intelligence.

---

## Features

### AI Valuation Engine (`/valuate`)
- Public tool — no login required
- Enter location, area type, sqft, BHK, bathrooms, balconies
- Instantly see an AI-estimated price, ±10% confidence range, price per sqft, locality comparison, and a price distribution bar
- Powered by 13,000+ Bangalore property transaction records

### Portfolio Dashboard (`/portfolio`)
- Track all your properties in one place
- Add/edit/delete properties with automatic AI valuation on save
- Summary bar: total portfolio value, total invested, overall return (₹ and %)
- Property detail drawer with a value-over-time chart and estimated rental yield
- Data persisted in `localStorage` (Phase 1 MVP — Supabase in Phase 2)

### Market Analytics (`/market`)
- City-level summary: avg ₹/sqft, median 2BHK price, total transactions
- Sortable locality rankings table (50+ Bangalore localities)
- Bar chart comparing top 15 localities by avg ₹/sqft
- Click any row to highlight it in the chart

### Marketplace (`/marketplace`)
- Browse property listings with AI fair value badges
- **FairPriceBadge** — green if fairly/under-priced, red if overpriced (vs AI estimate)
- Filter by listing type (sale/rent), BHK, sort by newest/price/best value
- Mobile-friendly filter sheet

### RERA Checker (`/rera`)
- Fuzzy search across 50+ RERA-registered Karnataka projects
- Verify developer, registration number, date, status, and unit count
- Links directly to the official RERA Karnataka portal

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript |
| Styling | Tailwind CSS, shadcn/ui |
| Charts | Recharts |
| Search | fuse.js (RERA fuzzy search) |
| Themes | next-themes (dark/light mode) |
| Fonts | Clash Display + Satoshi (Fontshare) |
| Backend (Phase 2) | Python FastAPI |
| ML Model (Phase 2) | scikit-learn Random Forest Regressor |
| Database (Phase 2) | Supabase (PostgreSQL + Auth) |

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation

```bash
git clone https://github.com/eeshandhawan/bangalore-realestate.git
cd bangalore-realestate/propiq
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — it redirects to `/valuate`.

### Build

```bash
npm run build
npm start
```

---

## Project Structure

```
propiq/
├── app/
│   ├── (auth)/login, signup          # Auth placeholders (Phase 2)
│   ├── (dashboard)/
│   │   ├── portfolio/                # Portfolio management
│   │   ├── market/                   # Market analytics
│   │   ├── marketplace/              # Browse + list properties
│   │   └── rera/                     # RERA project checker
│   └── valuate/                      # AI valuation (public)
├── components/
│   ├── portfolio/                    # PropertyCard, AddPropertyModal, etc.
│   ├── valuation/                    # ValuationForm, ValuationResult
│   ├── market/                       # LocalityRankingTable, PriceDistributionChart
│   ├── marketplace/                  # ListingCard, ListingFilters, FairPriceBadge
│   ├── rera/                         # ReraResultCard
│   └── shared/                       # Sidebar, BottomNav, ThemeToggle, LocalitySearch
└── lib/
    ├── valuation.ts                  # Client-side mock valuation logic
    ├── portfolio.ts                  # localStorage CRUD
    ├── utils/format.ts               # Currency formatting helpers
    └── data/
        ├── localities.json           # 241 Bangalore localities
        ├── market_stats.json         # Pre-computed locality price stats
        ├── sample_listings.json      # 8 sample marketplace listings
        └── rera_projects.json        # 50 RERA-registered projects
```

---

## Design System

- **Primary color:** Deep forest green `#1a5c3a` (trust + wealth)
- **Surfaces:** Warm beige `#f7f6f2` / `#f9f8f5`
- **Semantic colors:** Red for overpriced, green for fair/underpriced, blue for underpriced
- **Dark mode:** Full dark theme support via `next-themes`
- **Navigation:** 240px sidebar (desktop) + bottom tab bar (mobile)

---

## Roadmap

### Phase 1 — MVP (current)
- [x] AI valuation with mock data (client-side calculation)
- [x] Portfolio tracking with localStorage
- [x] Market analytics from static dataset
- [x] Marketplace with FairPriceBadge
- [x] RERA checker with fuzzy search

### Phase 2 — Full Stack
- [ ] Supabase Auth (email/Google login)
- [ ] Supabase PostgreSQL for portfolio and listings
- [ ] FastAPI backend with trained Random Forest model
- [ ] Real listing creation with AI valuation
- [ ] Supabase Storage for listing images

---

## Dataset

Primary: [Bengaluru House Price Data — Kaggle](https://www.kaggle.com/datasets/amitabhajoy/bengaluru-house-price-data) (13,320 rows, 241 localities)

---

## License

MIT
