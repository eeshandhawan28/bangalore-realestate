import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { calculateValuation } from "@/lib/valuation";
import { calculateScore } from "@/lib/scores";
import marketStats from "@/lib/data/market_stats.json";
import rentalYields from "@/lib/data/locality_rental_yields.json";
import sentimentData from "@/lib/data/locality_sentiment.json";
import priceHistory from "@/lib/data/locality_price_history.json";

const YIELDS = rentalYields as Record<string, {
  rent_2bhk: number;
  net_yield_pct: number;
  gross_yield_2bhk_pct: number;
  appreciation_5y_pct: number;
  appreciation_1y_pct: number;
  rental_demand: string;
}>;
const SENTIMENT = sentimentData as Record<string, {
  sentiment_score: number;
  trend: "up" | "stable" | "down";
  highlights: string[];
}>;
const HISTORY = priceHistory.localities as Record<string, number[]>;
const PERIODS = priceHistory.periods;

export function createMarketTools() {
  const getValuation = new DynamicStructuredTool({
    name: "get_valuation",
    description: "Estimates the market value of a property given its specifications.",
    schema: z.object({
      location:   z.string().describe("Locality in Bangalore"),
      total_sqft: z.number().describe("Total area in square feet"),
      bhk:        z.number().describe("Number of bedrooms (1–5)"),
      bathrooms:  z.number().optional().default(2),
      balconies:  z.number().optional().default(1),
      area_type:  z.string().optional().default("Super built-up Area"),
    }),
    async func({ location, total_sqft, bhk, bathrooms, balconies, area_type }) {
      const result = calculateValuation({
        location,
        area_type: area_type ?? "Super built-up Area",
        total_sqft,
        bhk,
        bathrooms: bathrooms ?? 2,
        balconies: balconies ?? 1,
      });
      const fairness =
        result.price_per_sqft < result.locality_avg_price_per_sqft * 0.95 ? "below market"
        : result.price_per_sqft > result.locality_avg_price_per_sqft * 1.05 ? "above market"
        : "at fair market value";
      return JSON.stringify({ ...result, fairness_label: fairness }, null, 2);
    },
  });

  const getMarketStats = new DynamicStructuredTool({
    name: "get_market_stats",
    description: "Returns market data for Bangalore localities (price/sqft, medians, listing counts).",
    schema: z.object({
      localities: z.array(z.string()).optional(),
      sort_by: z.enum(["avg_price_per_sqft", "listing_count", "median_2bhk_lakhs"]).optional().default("avg_price_per_sqft"),
    }),
    async func({ localities, sort_by }) {
      let data = [...marketStats.localities];
      if (localities && localities.length > 0) {
        const lower = localities.map((l) => l.toLowerCase());
        data = data.filter((loc) => lower.some((l) => loc.name.toLowerCase().includes(l)));
      } else {
        data = data.slice(0, 20);
      }
      const sortKey = sort_by ?? "avg_price_per_sqft";
      data.sort((a, b) => {
        const av = (a as Record<string, unknown>)[sortKey] as number ?? 0;
        const bv = (b as Record<string, unknown>)[sortKey] as number ?? 0;
        return bv - av;
      });
      return JSON.stringify({ city_summary: marketStats.city_summary, localities: data }, null, 2);
    },
  });

  const findBestLocalities = new DynamicStructuredTool({
    name: "find_best_localities",
    description: "Finds the best Bangalore localities within a budget and BHK preference.",
    schema: z.object({
      budget_lakhs: z.number(),
      bhk:          z.number(),
      max_results:  z.number().optional().default(5),
      sort_by:      z.enum(["affordability", "value_growth_potential"]).optional().default("value_growth_potential"),
    }),
    async func({ budget_lakhs, bhk, max_results, sort_by }) {
      const medianKey = bhk === 1 ? "median_1bhk_lakhs" : bhk === 2 ? "median_2bhk_lakhs" : "median_3bhk_lakhs";
      const affordable = marketStats.localities.filter((loc) => {
        const price = (loc as unknown as Record<string, number>)[medianKey];
        return price != null && price <= budget_lakhs;
      });
      const withGrowth = affordable.map((loc) => {
        const medianPrice = (loc as unknown as Record<string, number>)[medianKey];
        const growthProxy = loc.price_range.max > 0
          ? (loc.price_range.max - loc.avg_price_per_sqft) / loc.avg_price_per_sqft : 0;
        return { ...loc, median_price_lakhs: medianPrice, value_growth_potential: Math.round(growthProxy * 100) / 100 };
      });
      const sorted = sort_by === "affordability"
        ? withGrowth.sort((a, b) => a.median_price_lakhs - b.median_price_lakhs)
        : withGrowth.sort((a, b) => b.value_growth_potential - a.value_growth_potential);
      return JSON.stringify({ budget_lakhs, bhk, results: sorted.slice(0, max_results ?? 5) }, null, 2);
    },
  });

  const getLocalityDeepDive = new DynamicStructuredTool({
    name: "get_locality_deep_dive",
    description: "Returns a full profile for a single Bangalore locality: price history, yield, sentiment, investment score.",
    schema: z.object({
      locality: z.string().describe("Locality name (e.g. Koramangala, Whitefield)"),
    }),
    async func({ locality }) {
      const known = Object.keys(HISTORY);
      const match = known.find((k) => k.toLowerCase() === locality.toLowerCase())
        ?? known.find((k) => k.toLowerCase().includes(locality.toLowerCase()))
        ?? known.find((k) => locality.toLowerCase().includes(k.toLowerCase()));
      if (!match) return `No data found for "${locality}". Known: ${known.slice(0, 10).join(", ")}...`;

      const stats = marketStats.localities.find((l) => l.name.toLowerCase() === match.toLowerCase());
      const yld   = YIELDS[match];
      const sent  = SENTIMENT[match];
      const hist  = HISTORY[match];
      const score = calculateScore(match);
      const last6 = PERIODS.slice(-6);
      const last6Prices = hist ? hist.slice(-6) : [];

      return JSON.stringify({
        locality: match,
        market: stats ?? null,
        current_price_per_sqft: hist ? hist[hist.length - 1] : null,
        price_history_last_6: last6.map((p, i) => ({ period: p, price_per_sqft: last6Prices[i] })),
        rental_yield: yld ?? null,
        sentiment: sent ?? null,
        investment_score: { score: score.score, grade: score.grade, components: score.components },
      }, null, 2);
    },
  });

  const compareLocalities = new DynamicStructuredTool({
    name: "compare_localities",
    description: "Side-by-side comparison of 2–3 Bangalore localities. Returns price, yield, appreciation, and investment score.",
    schema: z.object({
      localities:    z.array(z.string()).min(2).max(3),
      buyer_profile: z.enum(["investor", "end_user"]).optional().default("investor"),
    }),
    async func({ localities, buyer_profile }) {
      const known = Object.keys(HISTORY);
      const profiles = localities.map((name) => {
        const match = known.find((k) => k.toLowerCase() === name.toLowerCase())
          ?? known.find((k) => k.toLowerCase().includes(name.toLowerCase()))
          ?? name;
        const stats = marketStats.localities.find((l) => l.name.toLowerCase() === match.toLowerCase());
        const yld   = YIELDS[match];
        const sent  = SENTIMENT[match];
        const hist  = HISTORY[match];
        const score = calculateScore(match);
        return {
          locality: match,
          avg_price_per_sqft: hist ? hist[hist.length - 1] : stats?.avg_price_per_sqft ?? null,
          median_2bhk_lakhs: stats?.median_2bhk_lakhs ?? null,
          net_yield_pct: yld?.net_yield_pct ?? null,
          appreciation_5y_pct: yld?.appreciation_5y_pct ?? null,
          appreciation_1y_pct: yld?.appreciation_1y_pct ?? null,
          rental_demand: yld?.rental_demand ?? null,
          sentiment_trend: sent?.trend ?? null,
          sentiment_highlights: sent?.highlights ?? [],
          investment_score: score.score,
          grade: score.grade,
        };
      });
      const recommended = buyer_profile === "end_user"
        ? [...profiles].sort((a, b) => (a.avg_price_per_sqft ?? 999999) - (b.avg_price_per_sqft ?? 999999))[0].locality
        : [...profiles].sort((a, b) => b.investment_score - a.investment_score)[0].locality;
      return JSON.stringify({
        comparison: profiles,
        recommended_for_profile: recommended,
        reason: buyer_profile === "end_user" ? "Lowest entry price per sqft" : "Highest PropIQ Investment Score",
      }, null, 2);
    },
  });

  const evaluateDeal = new DynamicStructuredTool({
    name: "evaluate_deal",
    description: "Evaluates whether a property's asking price is a good deal vs AI fair market value.",
    schema: z.object({
      location:            z.string(),
      bhk:                 z.number(),
      total_sqft:          z.number(),
      asking_price_lakhs:  z.number(),
      area_type:           z.string().optional().default("Super built-up Area"),
    }),
    async func({ location, bhk, total_sqft, asking_price_lakhs, area_type }) {
      const val = calculateValuation({
        location,
        area_type: area_type ?? "Super built-up Area",
        total_sqft,
        bhk,
        bathrooms: bhk >= 3 ? 2 : bhk,
        balconies: 1,
      });
      const yld  = YIELDS[location];
      const sent = SENTIMENT[location];
      const overUnderPct = ((asking_price_lakhs - val.predicted_price_lakhs) / val.predicted_price_lakhs) * 100;
      const verdict = overUnderPct <= -7 ? "GOOD DEAL" : overUnderPct <= 5 ? "FAIR PRICE" : "OVERPRICED";
      const estimatedMonthlyRent = yld
        ? Math.round((asking_price_lakhs * 100000 * (yld.net_yield_pct / 100)) / 12) : null;
      return JSON.stringify({
        asking_price_lakhs,
        ai_fair_value_lakhs: val.predicted_price_lakhs,
        price_range: { lower: val.lower_bound, upper: val.upper_bound },
        price_vs_fair_pct: `${overUnderPct > 0 ? "+" : ""}${overUnderPct.toFixed(1)}%`,
        verdict,
        estimated_monthly_rent: estimatedMonthlyRent,
        net_rental_yield_pct: yld?.net_yield_pct ?? null,
        area_sentiment: sent?.trend ?? null,
        area_development_signals: sent?.highlights ?? [],
      }, null, 2);
    },
  });

  return [getValuation, getMarketStats, findBestLocalities, getLocalityDeepDive, compareLocalities, evaluateDeal];
}
