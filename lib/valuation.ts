import marketStats from "./data/market_stats.json";
import localitySentiment from "./data/locality_sentiment.json";

type SentimentEntry = {
  sentiment_score: number;
  trend: "up" | "stable" | "down";
  highlights: string[];
};

const SENTIMENT_DATA = localitySentiment as Record<string, SentimentEntry>;

export interface ValuationInput {
  location: string;
  area_type: string;
  total_sqft: number;
  bhk: number;
  bathrooms: number;
  balconies: number;
  property_age_years?: number;
  floor_number?: number;
}

export interface ComparableProperty {
  location: string;
  bhk: number;
  sqft: number;
  price_lakhs: number;
  price_per_sqft: number;
}

export interface LocalitySentiment {
  score: number;
  trend: "up" | "stable" | "down";
  impact_pct: number;
  highlights: string[];
}

export interface ValuationResult {
  predicted_price_lakhs: number;
  lower_bound: number;
  upper_bound: number;
  confidence_half_width_pct: number;
  price_per_sqft: number;
  locality_avg_price_per_sqft: number;
  locality_name: string;
  locality_min_price_per_sqft: number;
  locality_max_price_per_sqft: number;
  comparable_properties: ComparableProperty[];
  price_adjustments: {
    sqft: number;
    area_type: number;
    bathrooms: number;
    balconies: number;
    age: number;
    floor: number;
    sentiment: number;
  };
  locality_sentiment: LocalitySentiment | null;
}

// Typical sqft for each BHK type in Bangalore (Super Built-up basis)
const TYPICAL_SQFT: Record<number, number> = {
  1: 600,
  2: 1000,
  3: 1400,
  4: 2000,
  5: 2800,
};

// Area type multiplier: how much more/less a property is worth vs Super Built-up baseline
const AREA_TYPE_FACTOR: Record<string, number> = {
  "Super Built-up": 1.0,
  "Built-up": 1.08,
  "Carpet": 1.22,
  "Plot": 0.75,
};

// Expected bathrooms for a given BHK type
const EXPECTED_BATHS: Record<number, number> = {
  1: 1,
  2: 2,
  3: 2,
  4: 3,
  5: 4,
};

function getFloorFactor(floor: number | undefined): number {
  if (floor === undefined) return 1.0;
  if (floor === 0) return 0.95;
  if (floor === 1) return 0.98;
  if (floor === 2) return 1.0;
  if (floor <= 8) return 1.02;
  if (floor <= 15) return 1.03;
  return 1.05;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function calculateValuation(input: ValuationInput): ValuationResult {
  const locality = marketStats.localities.find(
    (l) => l.name.toLowerCase() === input.location.toLowerCase()
  );

  const bhk = input.bhk;
  const typicalSqft = TYPICAL_SQFT[bhk] ?? TYPICAL_SQFT[5];

  // Base price: anchor to actual median BHK price for this locality
  let basePrice: number;
  if (locality) {
    if (bhk === 1) {
      basePrice = locality.median_1bhk_lakhs;
    } else if (bhk === 2) {
      basePrice = locality.median_2bhk_lakhs;
    } else if (bhk === 3) {
      basePrice = locality.median_3bhk_lakhs;
    } else {
      // 4+ BHK: extrapolate from 3BHK median using sqft ratio + luxury premium
      const luxuryPremium = bhk === 4 ? 1.05 : 1.10;
      basePrice =
        locality.median_3bhk_lakhs *
        ((TYPICAL_SQFT[bhk] ?? TYPICAL_SQFT[5]) / TYPICAL_SQFT[3]) *
        luxuryPremium;
    }
  } else {
    // Fallback to city summary
    const citySummary = marketStats.city_summary;
    if (bhk === 1) {
      basePrice = citySummary.median_1bhk_lakhs;
    } else if (bhk === 2) {
      basePrice = citySummary.median_2bhk_lakhs;
    } else if (bhk === 3) {
      basePrice = citySummary.median_3bhk_lakhs;
    } else {
      const luxuryPremium = bhk === 4 ? 1.05 : 1.10;
      basePrice =
        citySummary.median_3bhk_lakhs *
        ((TYPICAL_SQFT[bhk] ?? TYPICAL_SQFT[5]) / TYPICAL_SQFT[3]) *
        luxuryPremium;
    }
  }

  // Sqft adjustment: diminishing returns — larger gets less benefit, smaller loses more
  const sqftRatio = input.total_sqft / typicalSqft;
  const sqftAdjustment =
    sqftRatio <= 1 ? Math.pow(sqftRatio, 0.85) : Math.pow(sqftRatio, 0.70);

  // Area type adjustment
  const areaTypeFactor = AREA_TYPE_FACTOR[input.area_type] ?? 1.0;

  // Bathroom premium: +2% per extra bath above BHK-typical count
  const expectedBaths = EXPECTED_BATHS[bhk] ?? 2;
  const extraBaths = Math.max(0, input.bathrooms - expectedBaths);
  const bathPremium = 1 + extraBaths * 0.02;

  // Balcony premium: +1% per balcony, max 3 balconies
  const balconyPremium = 1 + Math.min(input.balconies, 3) * 0.01;

  // Age factor: -0.5% per year, capped at 20 years (max -10%)
  const ageFactor =
    input.property_age_years !== undefined
      ? 1 - Math.min(input.property_age_years, 20) * 0.005
      : 1.0;

  // Floor factor
  const floorFactor = getFloorFactor(input.floor_number);

  // Sentiment factor: locality development intelligence
  const sentimentEntry = SENTIMENT_DATA[input.location] ?? null;
  const sentimentFactor = sentimentEntry ? 1 + sentimentEntry.sentiment_score : 1.0;

  const predicted =
    basePrice *
    sqftAdjustment *
    areaTypeFactor *
    bathPremium *
    balconyPremium *
    ageFactor *
    floorFactor *
    sentimentFactor;

  // Dynamic confidence interval based on locality price spread
  const pricePerSqft = locality
    ? locality.avg_price_per_sqft
    : marketStats.city_summary.avg_price_per_sqft;
  const minPpSqft = locality?.price_range.min ?? pricePerSqft * 0.6;
  const maxPpSqft = locality?.price_range.max ?? pricePerSqft * 1.8;

  const spreadFactor = (maxPpSqft - minPpSqft) / pricePerSqft;
  const confidenceHalfWidth = clamp(spreadFactor * 0.09, 0.06, 0.18);

  const lower = predicted * (1 - confidenceHalfWidth);
  const upper = predicted * (1 + confidenceHalfWidth);

  // Comparable properties using updated typical sqft
  const comparables: ComparableProperty[] = [];
  if (locality) {
    const bhkOptions = [1, 2, 3].includes(bhk)
      ? [1, 2, 3].filter((b) => b !== bhk).slice(0, 2).concat([bhk])
      : [2, 3, bhk].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 3);

    const uniqueBhks = Array.from(new Set(bhkOptions)).slice(0, 3);
    uniqueBhks.forEach((b) => {
      const medianKey =
        b === 1
          ? "median_1bhk_lakhs"
          : b === 2
          ? "median_2bhk_lakhs"
          : "median_3bhk_lakhs";
      const priceLakhs =
        (locality as unknown as Record<string, number>)[medianKey] ?? predicted;
      const compSqft = TYPICAL_SQFT[b] ?? 1400;
      comparables.push({
        location: input.location,
        bhk: b,
        sqft: compSqft,
        price_lakhs: priceLakhs,
        price_per_sqft: Math.round((priceLakhs * 100000) / compSqft),
      });
    });
  }

  return {
    predicted_price_lakhs: Math.round(predicted * 10) / 10,
    lower_bound: Math.round(lower * 10) / 10,
    upper_bound: Math.round(upper * 10) / 10,
    confidence_half_width_pct: confidenceHalfWidth,
    price_per_sqft: Math.round((predicted * 100000) / input.total_sqft),
    locality_avg_price_per_sqft: pricePerSqft,
    locality_name: input.location,
    locality_min_price_per_sqft: minPpSqft,
    locality_max_price_per_sqft: maxPpSqft,
    comparable_properties: comparables,
    price_adjustments: {
      sqft: Math.round((sqftAdjustment - 1) * 100 * 10) / 10,
      area_type: Math.round((areaTypeFactor - 1) * 100 * 10) / 10,
      bathrooms: Math.round((bathPremium - 1) * 100 * 10) / 10,
      balconies: Math.round((balconyPremium - 1) * 100 * 10) / 10,
      age: Math.round((ageFactor - 1) * 100 * 10) / 10,
      floor: Math.round((floorFactor - 1) * 100 * 10) / 10,
      sentiment: Math.round((sentimentFactor - 1) * 100 * 10) / 10,
    },
    locality_sentiment: sentimentEntry
      ? {
          score: sentimentEntry.sentiment_score,
          trend: sentimentEntry.trend,
          impact_pct: Math.round(sentimentEntry.sentiment_score * 100 * 10) / 10,
          highlights: sentimentEntry.highlights,
        }
      : null,
  };
}
