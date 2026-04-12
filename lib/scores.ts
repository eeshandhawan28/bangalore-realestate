import marketStats from "./data/market_stats.json";
import rentalYields from "./data/locality_rental_yields.json";
import priceHistory from "./data/locality_price_history.json";
import sentimentData from "./data/locality_sentiment.json";
import poiData from "./data/locality_poi.json";

const CITY_AVG_PSF = marketStats.city_summary.avg_price_per_sqft; // 4890

const YIELDS = rentalYields as Record<string, {
  net_yield_pct: number;
  gross_yield_2bhk_pct: number;
  appreciation_5y_pct: number;
  appreciation_1y_pct: number;
  rental_demand: string;
}>;

const HISTORY = priceHistory.localities as Record<string, number[]>;
// Indices: 8 = Q4'23, 12 = Q4'25

const SENTIMENT = sentimentData as Record<string, {
  sentiment_score: number;
  trend: "up" | "stable" | "down";
  highlights: string[];
}>;

export interface POIData {
  schools: number;
  hospitals: number;
  malls: number;
  parks: number;
  offices: number;
  metro_distance_m: number;
  nearest_metro_name?: string;
  special_infra: string[];
}

const POI = poiData as unknown as Record<string, POIData & { _note?: string }>;

// Keyword fallback (used when POI data is missing for a locality)
const INFRA_KEYWORDS = [
  "metro", "it park", "expressway", "highway", "bmrcl", "bda",
  "tech park", "flyover", "itir", "airport", "namma metro",
  "purple line", "yellow line", "green line", "it corridor",
];

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function momentumScore(locality: string): number {
  const vals = HISTORY[locality];
  if (!vals || vals.length < 13) return 50;
  const q4_23 = vals[8];
  const q4_25 = vals[12];
  if (!q4_23 || !q4_25) return 50;
  const cagr = Math.pow(q4_25 / q4_23, 0.5) - 1; // 2Y CAGR
  return clamp((cagr / 0.15) * 100, 0, 100);
}

function yieldScore(locality: string): number {
  const y = YIELDS[locality];
  if (!y) return 50;
  return clamp(((y.net_yield_pct - 1) / 3) * 100, 0, 100);
}

function sentimentScore(locality: string): number {
  const s = SENTIMENT[locality];
  if (!s) return 50;
  const base = (s.sentiment_score / 0.15) * 80;
  const trendBonus = s.trend === "up" ? 20 : s.trend === "down" ? -20 : 0;
  return clamp(base + trendBonus, 0, 100);
}

function affordabilityScore(locality: string): number {
  const vals = HISTORY[locality];
  const localPsf = vals ? vals[vals.length - 1] : CITY_AVG_PSF;
  const ratio = CITY_AVG_PSF / localPsf;
  return clamp(((ratio - 0.5) / 1.5) * 100, 0, 100);
}

function infraScore(locality: string): number {
  const poi = POI[locality];

  if (poi && !poi._note) {
    // POI-based scoring (primary path)
    let score = 0;

    // Metro proximity — biggest premium driver
    if (poi.metro_distance_m <= 500)       score += 30;
    else if (poi.metro_distance_m <= 1500) score += 20;
    else if (poi.metro_distance_m <= 3000) score += 10;

    // Healthcare accessibility
    if (poi.hospitals >= 3)      score += 20;
    else if (poi.hospitals >= 1) score += 10;

    // Education density
    if (poi.schools >= 8)       score += 20;
    else if (poi.schools >= 3)  score += 10;

    // Retail / lifestyle amenities
    if (poi.malls >= 2)      score += 10;
    else if (poi.malls >= 1) score += 5;

    // Employment density
    if (poi.offices >= 15)      score += 15;
    else if (poi.offices >= 5)  score += 8;

    // Special infrastructure bonus
    const special = poi.special_infra ?? [];
    if (special.includes("airport"))       score += 15;
    if (special.includes("it_park") || special.includes("it_corridor") || special.includes("itir")) score += 10;
    if (special.includes("aerospace_sez")) score += 5;

    return clamp(score, 0, 100);
  }

  // Keyword fallback for localities without POI data
  const s = SENTIMENT[locality];
  if (!s) return 20;
  const text = s.highlights.join(" ").toLowerCase();
  const hits = INFRA_KEYWORDS.filter((kw) => text.includes(kw)).length;
  if (hits === 0) return 20;
  if (hits === 1) return 50;
  if (hits === 2) return 75;
  return 100;
}

export interface LocalityScore {
  locality: string;
  score: number;
  grade: "Strong Buy" | "Buy" | "Hold" | "Watch";
  components: {
    momentum: number;
    yield: number;
    sentiment: number;
    affordability: number;
    infra: number;
  };
  raw: {
    cagr_2y_pct: number;
    net_yield_pct: number;
    sentiment_score: number;
    sentiment_trend: "up" | "stable" | "down";
    price_per_sqft: number;
    city_avg_psf: number;
    infra_hits: number;            // keyword hits (legacy; 0 when POI data used)
    highlights: string[];
    poi: POIData | null;           // POI breakdown — null if not available
  };
}

export function calculateScore(locality: string): LocalityScore {
  const vals = HISTORY[locality];
  const q4_23 = vals?.[8] ?? 0;
  const q4_25 = vals?.[12] ?? 0;
  const cagr = q4_23 > 0 ? (Math.pow(q4_25 / q4_23, 0.5) - 1) * 100 : 0;

  const yieldData = YIELDS[locality];
  const sentData = SENTIMENT[locality];
  const poiEntry = POI[locality];

  const localPsf = q4_25 || CITY_AVG_PSF;
  const sentText = sentData ? sentData.highlights.join(" ").toLowerCase() : "";
  const infraHits = INFRA_KEYWORDS.filter((kw) => sentText.includes(kw)).length;

  const m = momentumScore(locality);
  const y = yieldScore(locality);
  const s = sentimentScore(locality);
  const a = affordabilityScore(locality);
  const i = infraScore(locality);

  const score = Math.round(m * 0.20 + y * 0.20 + s * 0.25 + a * 0.15 + i * 0.20);

  const grade =
    score >= 80 ? "Strong Buy" :
    score >= 65 ? "Buy" :
    score >= 50 ? "Hold" : "Watch";

  const poiClean: POIData | null = poiEntry && !poiEntry._note
    ? { schools: poiEntry.schools, hospitals: poiEntry.hospitals, malls: poiEntry.malls, parks: poiEntry.parks, offices: poiEntry.offices, metro_distance_m: poiEntry.metro_distance_m, nearest_metro_name: poiEntry.nearest_metro_name, special_infra: poiEntry.special_infra }
    : null;

  return {
    locality,
    score,
    grade,
    components: { momentum: Math.round(m), yield: Math.round(y), sentiment: Math.round(s), affordability: Math.round(a), infra: Math.round(i) },
    raw: {
      cagr_2y_pct: Math.round(cagr * 10) / 10,
      net_yield_pct: yieldData?.net_yield_pct ?? 0,
      sentiment_score: sentData?.sentiment_score ?? 0,
      sentiment_trend: sentData?.trend ?? "stable",
      price_per_sqft: localPsf,
      city_avg_psf: CITY_AVG_PSF,
      infra_hits: infraHits,
      highlights: sentData?.highlights ?? [],
      poi: poiClean,
    },
  };
}

export function scoreAll(): LocalityScore[] {
  const localities = Object.keys(HISTORY);
  return localities
    .map((loc) => calculateScore(loc))
    .sort((a, b) => b.score - a.score);
}
