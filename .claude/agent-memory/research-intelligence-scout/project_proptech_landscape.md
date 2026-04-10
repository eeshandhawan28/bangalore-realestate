---
name: PropTech Landscape Research - Zillow vs Housiey + India Data APIs
description: Competitive intelligence on Zillow, Housiey, and India real estate data sources relevant to PropIQ positioning
type: project
---

# PropTech Competitive Landscape (Researched April 2026)

## Zillow (US Market)
- Zestimate covers 118 million homes using neural network model
- On-market error rate: ~1.83-1.94%; Off-market error rate: 7.01-7.20%
- Approximately 1 in 5 homes estimated off by 20%+ at final sale
- Key weakness: no hyperlocal intelligence, poor for unique/luxury properties, US-only
- APIs available via zillowgroup.com/developers: Zestimate API, Public Records, Neighborhood Data, MLS Listings, Mortgage, Rentals (~20 APIs total)
- Bridge Interactive API for MLS data (invite-only, MLS partner approval required)
- Free for non-commercial use; commercial requires paid tiers
- Trustpilot/ConsumerAffairs: ~1.8 stars - major complaints about inaccuracy, fraud listings, poor support

## Housiey (India Market)
- Focus: Direct builder-to-buyer, zero brokerage model
- Markets: Mumbai, Pune, Bangalore, Ahmedabad (4 cities)
- Key differentiators: 360-degree virtual tours, RERA verification, floor plans, builder direct pricing
- Rs 8,000+ crores in facilitated sales, 6 lakh+ monthly users
- Critical gap: NO Zestimate-equivalent (no AI price prediction engine)
- Critical gap: NO historical price trend analytics for investors
- Critical gap: NO rental yield calculator or investment ROI tools
- Critical gap: NO API access for developers
- Critical gap: Only new-launch properties, no resale market

## India Real Estate Data Sources for PropIQ

### Commercial APIs (Subscription)
- **PropEquity**: Transaction data, rental trends, pricing analytics - subscription model, contact for pricing
- **Propstack/Zapkey**: India's largest private transaction repository (1.4B sqft), 1M+ transactions - no public API pricing
- **CRE Matrix**: Deep analytics for commercial + residential, 27 cities residential coverage, Bangalore micromarket data including Whitefield/ORR/CBD
- **PropAlert**: 57,000+ developers, 44 cities, collaborates with 200+ banks

### Government / Free Sources
- **RBI House Price Index**: Quarterly All-India HPI + city-wise, 10 cities, free download
- **data.gov.in**: Open Government Data platform, requires API key (free), limited real estate transaction specifics
- **Karnataka RERA** (rera.karnataka.gov.in): Project registry, RERA-registered projects in Bangalore - web scraping possible, no official API
- **IGR Karnataka / Kaveri 2.0** (igr.karnataka.gov.in): Stamp duty and registration records - portal access, no open API

### Scraped/Third-party
- NoBroker, 99acres, MagicBricks scrapers available via Apify (paid per call)
- No official APIs from these platforms for third-party developers

## Key PropIQ Opportunity Gaps
1. India has NO Zestimate equivalent - massive whitespace
2. No hyperlocal "neighborhood score" tool for Indian cities
3. RERA + IGR data is public but not aggregated or queryable via API
4. Resale market is underserved (Housiey only does new launches)
5. Rental yield analytics completely absent from Indian consumer platforms
6. Investment ROI calculator combining price appreciation + rental income missing

**Why:** Identifying where PropIQ can differentiate vs existing India platforms and what data stack to build on
**How to apply:** Prioritize building an India-first AVM (Automated Valuation Model) using RERA + IGR + PropEquity/Propstack data; differentiate from Housiey by covering resale + analytics
