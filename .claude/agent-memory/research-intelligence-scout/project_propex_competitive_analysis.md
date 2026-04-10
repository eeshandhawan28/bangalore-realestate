---
name: PropEx.ai Competitive Analysis
description: Deep competitive intelligence on PropEx.ai (India PropTech, Bangalore) vs PropIQ — features, gaps, AI approach, business model (April 2026)
type: project
---

# PropEx.ai Competitive Analysis (Researched April 2026)

## Company Overview
- Founder & CEO: Suresh Rangarajan
- HQ: Bengaluru, India
- Company size: 501-1,000 employees (notably large for ARR of Rs. 100Mn)
- ARR: Rs. 100 million (~$1.2M USD) — relatively modest given headcount
- Properties listed: 10,000+
- Builder partnerships: 300+ builders
- Markets: Bangalore primary, expanding to Hyderabad, Goa, Mumbai
- Self-described as "India's First Property Exchange"
- RERA registered: Karnataka + Telangana

## Core Features
1. **PropGPT** — NLP chatbot for property discovery; conversational search; NOT a quantitative analytics tool
2. **PropEstimate / Net Property Score (NPS)** — property valuation score; methodology opaque, no published accuracy stats
3. **Buyer Profile Score (BPS)** — intent scoring for buyers; helps sellers prioritize leads
4. **i-Connect / i-Meet / i-Visit** — virtual communication tools (direct contact, video meetings, virtual tours)
5. **PropVerse** — VR/immersive property experience sub-platform (SSL cert expired as of April 2026 — suggesting deprioritized)
6. **RentX** — rental marketplace vertical (subscription-based)
7. **Bid & Offers system** — exchange-style negotiation between buyers/sellers
8. **WhatsApp/SMS/push alerts** — real-time property notifications
9. **Free listing** — zero brokerage, zero listing fee for sellers

## Business Model
- Free listings for sellers
- Zero brokerage positioning
- Revenue likely from: developer partnerships/commissions, RentX subscriptions, premium lead placement
- Pricing is NOT publicly disclosed — opaque monetization

## AI Reality Check (vs. Marketing Claims)
- PropGPT: NLP chatbot for Q&A — likely a fine-tuned LLM or retrieval-augmented system over their listing database. NOT a quantitative analytics AI.
- PropEstimate/NPS: "Smart property price calculator" — methodology entirely undisclosed. No accuracy statistics published. No comparison to actual transaction data. This is a MARKETING claim, not validated AVM.
- BPS: Likely a simple rules-based scoring system (budget + requirements match), not genuine ML propensity modeling.
- Accuracy claims on blog cite McKinsey/MarketsandMarkets stats about industry broadly — NOT PropEx's own model performance.
- No published case studies, no backtesting results, no third-party validation.

## Key Weaknesses / Gaps
1. **No validated AVM** — NPS/PropEstimate has no published accuracy. Pure black box.
2. **No investor analytics** — No rental yield calculator, no price appreciation trends, no ROI modeling
3. **No portfolio tracking** — No tool for investors to track multiple properties
4. **No historical price charts** — Cannot see how a locality has appreciated over time
5. **No RERA document deep-dive** — Mentions RERA registration but no document verification or project risk scoring
6. **PropVerse SSL expired** — VR feature appears abandoned/deprioritized
7. **No resale market depth** — Heavily developer/builder focused; resale is thin
8. **Pricing entirely opaque** — Users cannot understand monetization model
9. **Limited geography** — Primarily Bangalore; Hyderabad/Goa/Mumbai expansions appear thin
10. **No API or data access** — No developer ecosystem, no data partnerships publicized
11. **Employee complaints (Glassdoor)** — "Worst workplace," commission not paid — suggests sales-heavy culture, high churn, possibly aggressive telemarketing (mirrors NoBroker complaints)
12. **Platform maturity issues** — Reviewer notes "relatively new platform, so it might have some bugs"
13. **No fractional ownership or investment tools** — Missing the 2026 proptech trend of fractional investment
14. **Blog is SEO-focused, not insight-driven** — Content marketing is keyword-stuffed, lacks data journalism

## User Sentiment Summary
- Justdial: 4.5/5 based on 73 reviews (likely curated)
- Glassdoor (employer reviews): Negative — commission disputes, poor management
- No significant Trustpilot or G2 presence — indicates limited enterprise/B2B adoption
- No Reddit discussions found — low organic community engagement
- App (Google Play): No extractable rating data from scrape

## Competitive Positioning vs. PropIQ

| Dimension | PropEx.ai | PropIQ (current MVP) | PropIQ Opportunity |
|-----------|-----------|---------------------|-------------------|
| AI Valuation | Black-box NPS, no accuracy stats | Mock calculation, client-side | Build validated RF model with RERA+IGR data |
| Investor Analytics | None | Market table (mock) | Rental yield, ROI, appreciation charts |
| Portfolio Tracking | None | localStorage-based | Supabase-backed with multi-property dashboard |
| RERA Verification | Registration badge only | Fuzzy search of 50 projects | Full document parsing + risk scoring |
| Hyperlocal Data | Limited | 241 localities | Neighborhood score cards |
| VR/Virtual Tours | PropVerse (apparently broken) | None | Lower priority — competitor has abandoned |
| Conversational AI | PropGPT chatbot | None | Phase 2 opportunity |
| Rental Market | RentX vertical | None | Yield analytics as differentiator |
| Transparency | Opaque pricing/methodology | — | Publish model methodology as trust signal |

## Key PropIQ Differentiators to Build
1. **Validated AVM** with published accuracy metrics — beats PropEx's black-box NPS
2. **Investor dashboard** (rental yield + appreciation + ROI) — completely absent from PropEx
3. **RERA risk scoring** — parse actual documents, not just show registration
4. **Hyperlocal neighborhood scorecards** — PropEx has no locality intelligence layer
5. **Transparent pricing model** — make monetization clear, builds trust vs PropEx's opacity
6. **Historical price charts per locality** — a basic feature PropEx does not offer

**Why:** PropEx.ai is PropIQ's most direct India/Bangalore competitor. It has 300+ builder relationships and a large team but weak analytics depth and opaque AI. PropIQ's advantage is investor-grade analytics and validated AI.
**How to apply:** When building Phase 2 features, prioritize investor analytics and AVM accuracy/transparency as the primary differentiation wedge against PropEx.
