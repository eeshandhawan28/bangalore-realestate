import marketStats from "./data/market_stats.json";

export interface ValuationInput {
  location: string;
  area_type: string;
  total_sqft: number;
  bhk: number;
  bathrooms: number;
  balconies: number;
}

export interface ComparableProperty {
  location: string;
  bhk: number;
  sqft: number;
  price_lakhs: number;
  price_per_sqft: number;
}

export interface ValuationResult {
  predicted_price_lakhs: number;
  lower_bound: number;
  upper_bound: number;
  price_per_sqft: number;
  locality_avg_price_per_sqft: number;
  locality_name: string;
  locality_min_price_per_sqft: number;
  locality_max_price_per_sqft: number;
  comparable_properties: ComparableProperty[];
}

const BHK_MULTIPLIER: Record<number, number> = {
  1: 0.88,
  2: 1.0,
  3: 1.06,
  4: 1.12,
  5: 1.18,
};

export function calculateValuation(input: ValuationInput): ValuationResult {
  const locality = marketStats.localities.find(
    (l) => l.name.toLowerCase() === input.location.toLowerCase()
  );

  const pricePerSqft = locality
    ? locality.avg_price_per_sqft
    : marketStats.city_summary.avg_price_per_sqft;

  const bhkMultiplier = BHK_MULTIPLIER[input.bhk] ?? 1.18;
  const predicted = ((pricePerSqft * input.total_sqft) / 100000) * bhkMultiplier;

  const lower = predicted * 0.9;
  const upper = predicted * 1.1;

  const comparables: ComparableProperty[] = [];
  if (locality) {
    const bhkOptions = [2, 3, input.bhk].filter(
      (v, i, arr) => arr.indexOf(v) === i
    );
    bhkOptions.slice(0, 3).forEach((bhk) => {
      const medianKey = bhk === 2 ? "median_2bhk_lakhs" : bhk === 3 ? "median_3bhk_lakhs" : "median_1bhk_lakhs";
      const priceLakhs = (locality as unknown as Record<string, number>)[medianKey] ?? predicted;
      const typicalSqft = bhk * 550 + 150;
      comparables.push({
        location: input.location,
        bhk,
        sqft: typicalSqft,
        price_lakhs: priceLakhs,
        price_per_sqft: Math.round((priceLakhs * 100000) / typicalSqft),
      });
    });
  }

  return {
    predicted_price_lakhs: Math.round(predicted * 10) / 10,
    lower_bound: Math.round(lower * 10) / 10,
    upper_bound: Math.round(upper * 10) / 10,
    price_per_sqft: Math.round((predicted * 100000) / input.total_sqft),
    locality_avg_price_per_sqft: pricePerSqft,
    locality_name: input.location,
    locality_min_price_per_sqft: locality?.price_range.min ?? pricePerSqft * 0.6,
    locality_max_price_per_sqft: locality?.price_range.max ?? pricePerSqft * 1.8,
    comparable_properties: comparables,
  };
}
