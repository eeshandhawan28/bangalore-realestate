import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseClient } from "@supabase/supabase-js";
import { calculateValuation } from "@/lib/valuation";
import rentalYields from "@/lib/data/locality_rental_yields.json";
import sentimentData from "@/lib/data/locality_sentiment.json";

const YIELDS = rentalYields as Record<string, {
  net_yield_pct: number;
  appreciation_5y_pct: number;
  appreciation_1y_pct: number;
  rental_demand: string;
}>;
const SENTIMENT = sentimentData as Record<string, {
  trend: "up" | "stable" | "down";
  highlights: string[];
}>;

export function createPortfolioTools(supabase: SupabaseClient) {
  const getPortfolio = new DynamicStructuredTool({
    name: "get_portfolio",
    description: "Fetches all properties in the user's portfolio from the database.",
    schema: z.object({
      include_valuations: z.boolean().optional().describe("If true, run AI valuation for each property"),
    }),
    async func({ include_valuations }) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return "User is not authenticated.";
      const { data, error } = await supabase.from("properties").select("*").order("created_at", { ascending: false });
      if (error) return `Error: ${error.message}`;
      if (!data || data.length === 0) return "No properties in portfolio.";
      const properties = data.map((p: Record<string, unknown>) => {
        const base = {
          id: p.id, name: p.name, location: p.location, bhk: p.bhk,
          total_sqft: p.total_sqft, purchase_price_lakhs: p.purchase_price_lakhs,
          ai_estimated_value_lakhs: p.ai_estimated_value_lakhs,
          ownership_type: p.ownership_type, purchase_date: p.purchase_date,
        };
        if (include_valuations && !p.ai_estimated_value_lakhs) {
          const val = calculateValuation({
            location: p.location as string, area_type: p.area_type as string,
            total_sqft: p.total_sqft as number, bhk: p.bhk as number,
            bathrooms: p.bathrooms as number, balconies: p.balconies as number,
          });
          return { ...base, ai_estimated_value_lakhs: val.predicted_price_lakhs };
        }
        return base;
      });
      return JSON.stringify(properties, null, 2);
    },
  });

  const getPortfolioSummary = new DynamicStructuredTool({
    name: "get_portfolio_summary",
    description: "Returns total portfolio value, invested, returns, and properties ranked by gain.",
    schema: z.object({}),
    async func() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return "User is not authenticated.";
      const { data, error } = await supabase.from("properties").select("*");
      if (error) return `Error: ${error.message}`;
      if (!data || data.length === 0) return "No properties in portfolio.";
      const totalInvested = data.reduce((s: number, p: Record<string, unknown>) => s + (p.purchase_price_lakhs as number), 0);
      const totalValue    = data.reduce((s: number, p: Record<string, unknown>) => s + ((p.ai_estimated_value_lakhs as number) ?? (p.purchase_price_lakhs as number)), 0);
      const totalReturn   = totalValue - totalInvested;
      const returnPct     = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;
      const ranked = [...data].map((p: Record<string, unknown>) => {
        const current = (p.ai_estimated_value_lakhs as number) ?? (p.purchase_price_lakhs as number);
        const gain    = current - (p.purchase_price_lakhs as number);
        return {
          name: p.name, location: p.location,
          purchase_price_lakhs: p.purchase_price_lakhs, current_value_lakhs: current,
          gain_lakhs: Math.round(gain * 10) / 10,
          gain_percent: Math.round((gain / (p.purchase_price_lakhs as number)) * 1000) / 10,
        };
      }).sort((a, b) => b.gain_percent - a.gain_percent);
      return JSON.stringify({
        count: data.length,
        total_invested_lakhs:      Math.round(totalInvested * 10) / 10,
        total_current_value_lakhs: Math.round(totalValue    * 10) / 10,
        total_return_lakhs:        Math.round(totalReturn   * 10) / 10,
        return_percent:            Math.round(returnPct     * 10) / 10,
        properties_ranked_by_gain: ranked,
      }, null, 2);
    },
  });

  const getPortfolioHealth = new DynamicStructuredTool({
    name: "get_portfolio_health",
    description: "Scores portfolio health across diversification, yield, appreciation, and liquidity (0–100).",
    schema: z.object({}),
    async func() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return "User is not authenticated.";
      const { data, error } = await supabase.from("properties").select("*");
      if (error) return `Error: ${error.message}`;
      if (!data || data.length === 0) return "No properties in portfolio.";
      const localities = new Set(data.map((p: Record<string, unknown>) => p.location as string));
      const diversificationScore = Math.min((localities.size / 4) * 100, 100);
      const avgYield  = data.reduce((s: number, p: Record<string, unknown>) => s + (YIELDS[p.location as string]?.net_yield_pct ?? 2.5), 0) / data.length;
      const yieldScore = Math.min((avgYield / 3.1) * 100, 100);
      const avgAppreciation = data.reduce((s: number, p: Record<string, unknown>) => s + (YIELDS[p.location as string]?.appreciation_1y_pct ?? 5), 0) / data.length;
      const appreciationScore = Math.min((avgAppreciation / 10) * 100, 100);
      const highDemand = data.filter((p: Record<string, unknown>) => YIELDS[p.location as string]?.rental_demand === "High").length;
      const liquidityScore = data.length > 0 ? (highDemand / data.length) * 100 : 0;
      const overall = Math.round(diversificationScore * 0.25 + yieldScore * 0.30 + appreciationScore * 0.25 + liquidityScore * 0.20);
      return JSON.stringify({
        overall_score: overall,
        verdict: overall >= 75 ? "Healthy" : overall >= 50 ? "Needs attention" : "At risk",
        breakdown: {
          diversification: { score: Math.round(diversificationScore), localities_count: localities.size },
          yield:           { score: Math.round(yieldScore), avg_net_yield_pct: avgYield.toFixed(2) },
          appreciation:    { score: Math.round(appreciationScore), avg_1y_pct: avgAppreciation.toFixed(1) },
          liquidity:       { score: Math.round(liquidityScore), high_demand_count: highDemand },
        },
      }, null, 2);
    },
  });

  const getSellRecommendation = new DynamicStructuredTool({
    name: "get_sell_recommendation",
    description: "Analyses portfolio properties and recommends HOLD, CONSIDER SELLING, or NEUTRAL per property.",
    schema: z.object({
      property_id: z.string().optional(),
    }),
    async func({ property_id }) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return "User is not authenticated.";
      const query = supabase.from("properties").select("*");
      const { data, error } = property_id ? await query.eq("id", property_id) : await query;
      if (error) return `Error: ${error.message}`;
      if (!data || data.length === 0) return "No properties found.";
      const recommendations = (data as Record<string, unknown>[]).map((p) => {
        const loc  = p.location as string;
        const yld  = YIELDS[loc];
        const sent = SENTIMENT[loc];
        const val  = calculateValuation({
          location: loc, area_type: (p.area_type as string) ?? "Super built-up Area",
          total_sqft: p.total_sqft as number, bhk: p.bhk as number,
          bathrooms: (p.bathrooms as number) ?? 2, balconies: (p.balconies as number) ?? 1,
        });
        const purchasePrice = p.purchase_price_lakhs as number;
        const gainPct = ((val.predicted_price_lakhs - purchasePrice) / purchasePrice) * 100;
        const sellSignals: string[] = [];
        if (gainPct > 40) sellSignals.push(`+${gainPct.toFixed(0)}% appreciation — strong exit opportunity`);
        if ((yld?.net_yield_pct ?? 3) < 2.5) sellSignals.push(`Low yield ${yld?.net_yield_pct?.toFixed(2) ?? "~2.5"}%`);
        if (sent?.trend === "down") sellSignals.push("Declining area sentiment");
        const holdSignals: string[] = [];
        if ((yld?.appreciation_1y_pct ?? 5) > 8) holdSignals.push(`Strong 1Y momentum +${yld?.appreciation_1y_pct}%`);
        if (sent?.trend === "up") holdSignals.push("Improving sentiment — infrastructure incoming");
        if ((yld?.net_yield_pct ?? 3) > 3.5) holdSignals.push(`Above-average yield ${yld?.net_yield_pct}%`);
        const recommendation = sellSignals.length >= 2 ? "CONSIDER SELLING" : holdSignals.length >= 2 ? "HOLD" : "NEUTRAL";
        return { name: p.name, location: loc, purchase_price_lakhs: purchasePrice,
          current_estimated_value_lakhs: val.predicted_price_lakhs, gain_pct: gainPct.toFixed(1),
          recommendation, sell_signals: sellSignals, hold_signals: holdSignals };
      });
      return JSON.stringify(recommendations, null, 2);
    },
  });

  return [getPortfolio, getPortfolioSummary, getPortfolioHealth, getSellRecommendation];
}
