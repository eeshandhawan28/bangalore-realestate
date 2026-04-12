import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseClient } from "@supabase/supabase-js";
import { calculateValuation } from "@/lib/valuation";
import { calculateScore } from "@/lib/scores";
import marketStats from "@/lib/data/market_stats.json";
import reraProjects from "@/lib/data/rera_projects.json";
import rentalYields from "@/lib/data/locality_rental_yields.json";
import sentimentData from "@/lib/data/locality_sentiment.json";
import priceHistory from "@/lib/data/locality_price_history.json";
import Fuse from "fuse.js";

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

export function createAgentTools(supabase: SupabaseClient) {
  const getPortfolio = new DynamicStructuredTool({
    name: "get_portfolio",
    description:
      "Fetches all properties in the user's portfolio from the database. Use this to answer questions about specific properties.",
    schema: z.object({
      include_valuations: z
        .boolean()
        .optional()
        .describe("If true, run AI valuation for each property"),
    }),
    async func({ include_valuations }) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return "User is not authenticated. Please sign in to view your portfolio.";

      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) return `Error fetching properties: ${error.message}`;
      if (!data || data.length === 0) return "No properties found in your portfolio.";

      const properties = data.map((p: Record<string, unknown>) => {
        const base = {
          id: p.id,
          name: p.name,
          location: p.location,
          bhk: p.bhk,
          total_sqft: p.total_sqft,
          purchase_price_lakhs: p.purchase_price_lakhs,
          ai_estimated_value_lakhs: p.ai_estimated_value_lakhs,
          ownership_type: p.ownership_type,
          purchase_date: p.purchase_date,
        };

        if (include_valuations && !p.ai_estimated_value_lakhs) {
          const val = calculateValuation({
            location: p.location as string,
            area_type: p.area_type as string,
            total_sqft: p.total_sqft as number,
            bhk: p.bhk as number,
            bathrooms: p.bathrooms as number,
            balconies: p.balconies as number,
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
    description:
      "Returns a financial summary of the user's entire portfolio: total value, total invested, returns, and ranking by gain.",
    schema: z.object({}),
    async func() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return "User is not authenticated. Please sign in to view your portfolio summary.";

      const { data, error } = await supabase
        .from("properties")
        .select("*");

      if (error) return `Error fetching properties: ${error.message}`;
      if (!data || data.length === 0) return "No properties in portfolio.";

      const totalInvested = data.reduce((sum: number, p: Record<string, unknown>) => sum + (p.purchase_price_lakhs as number), 0);
      const totalValue = data.reduce((sum: number, p: Record<string, unknown>) => {
        return sum + ((p.ai_estimated_value_lakhs as number) ?? (p.purchase_price_lakhs as number));
      }, 0);
      const totalReturn = totalValue - totalInvested;
      const returnPercent = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;

      const ranked = [...data]
        .map((p: Record<string, unknown>) => {
          const current = (p.ai_estimated_value_lakhs as number) ?? (p.purchase_price_lakhs as number);
          const gain = current - (p.purchase_price_lakhs as number);
          const gainPct = ((gain / (p.purchase_price_lakhs as number)) * 100);
          return { name: p.name, location: p.location, purchase_price_lakhs: p.purchase_price_lakhs, current_value_lakhs: current, gain_lakhs: Math.round(gain * 10) / 10, gain_percent: Math.round(gainPct * 10) / 10 };
        })
        .sort((a, b) => b.gain_percent - a.gain_percent);

      return JSON.stringify({
        count: data.length,
        total_invested_lakhs: Math.round(totalInvested * 10) / 10,
        total_current_value_lakhs: Math.round(totalValue * 10) / 10,
        total_return_lakhs: Math.round(totalReturn * 10) / 10,
        return_percent: Math.round(returnPercent * 10) / 10,
        properties_ranked_by_gain: ranked,
      }, null, 2);
    },
  });

  const getValuation = new DynamicStructuredTool({
    name: "get_valuation",
    description:
      "Estimates the market value of a property given its specifications. Use this to value a specific property or compare asking price to market.",
    schema: z.object({
      location: z.string().describe("Locality in Bangalore (e.g. Whitefield, Koramangala)"),
      total_sqft: z.number().describe("Total area in square feet"),
      bhk: z.number().describe("Number of bedrooms (1–5)"),
      bathrooms: z.number().optional().default(2),
      balconies: z.number().optional().default(1),
      area_type: z.string().optional().default("Super built-up Area"),
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
        result.price_per_sqft < result.locality_avg_price_per_sqft * 0.95
          ? "below market"
          : result.price_per_sqft > result.locality_avg_price_per_sqft * 1.05
          ? "above market"
          : "at fair market value";

      return JSON.stringify({ ...result, fairness_label: fairness }, null, 2);
    },
  });

  const getMarketStats = new DynamicStructuredTool({
    name: "get_market_stats",
    description:
      "Returns market data (price per sqft, median prices, listing counts) for Bangalore localities. Use to compare areas or understand market trends.",
    schema: z.object({
      localities: z
        .array(z.string())
        .optional()
        .describe("Filter to specific localities. If omitted, returns top 20 by listing count."),
      sort_by: z
        .enum(["avg_price_per_sqft", "listing_count", "median_2bhk_lakhs"])
        .optional()
        .default("avg_price_per_sqft"),
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

      return JSON.stringify({
        city_summary: marketStats.city_summary,
        localities: data,
      }, null, 2);
    },
  });

  const findBestLocalities = new DynamicStructuredTool({
    name: "find_best_localities",
    description:
      "Finds the best Bangalore localities to buy a property given a budget and BHK preference. Returns affordable areas with growth potential.",
    schema: z.object({
      budget_lakhs: z.number().describe("Maximum budget in lakhs"),
      bhk: z.number().describe("Desired number of bedrooms"),
      max_results: z.number().optional().default(5),
      sort_by: z
        .enum(["affordability", "value_growth_potential"])
        .optional()
        .default("value_growth_potential"),
    }),
    async func({ budget_lakhs, bhk, max_results, sort_by }) {
      const medianKey =
        bhk === 1 ? "median_1bhk_lakhs" : bhk === 2 ? "median_2bhk_lakhs" : "median_3bhk_lakhs";

      const affordable = marketStats.localities.filter((loc) => {
        const price = (loc as unknown as Record<string, number>)[medianKey];
        return price != null && price <= budget_lakhs;
      });

      const withGrowth = affordable.map((loc) => {
        const medianPrice = (loc as unknown as Record<string, number>)[medianKey];
        const growthProxy =
          loc.price_range.max > 0
            ? (loc.price_range.max - loc.avg_price_per_sqft) / loc.avg_price_per_sqft
            : 0;
        return { ...loc, median_price_lakhs: medianPrice, value_growth_potential: Math.round(growthProxy * 100) / 100 };
      });

      const sorted =
        sort_by === "affordability"
          ? withGrowth.sort((a, b) => a.median_price_lakhs - b.median_price_lakhs)
          : withGrowth.sort((a, b) => b.value_growth_potential - a.value_growth_potential);

      return JSON.stringify({
        budget_lakhs,
        bhk,
        results: sorted.slice(0, max_results ?? 5),
      }, null, 2);
    },
  });

  const createListing = new DynamicStructuredTool({
    name: "create_listing",
    description:
      "Creates a marketplace listing for a property in the user's portfolio. Use when the user explicitly wants to list a property for sale or rent.",
    schema: z.object({
      property_id: z.string().optional().describe("ID of the property from get_portfolio"),
      title: z.string().describe("Listing title"),
      listing_type: z.enum(["sale", "rent"]),
      asking_price_lakhs: z.number().optional(),
      monthly_rent: z.number().optional(),
      description: z.string().optional(),
      contact_email: z.string().optional(),
    }),
    async func({ property_id, title, listing_type, asking_price_lakhs, monthly_rent, description, contact_email }) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return "User is not authenticated. Please sign in to create a listing.";

      let aiEstimate: number | null = null;
      let propDetails: Record<string, unknown> | null = null;

      if (property_id) {
        const { data: prop } = await supabase
          .from("properties")
          .select("*")
          .eq("id", property_id)
          .single();

        if (prop) {
          propDetails = prop;
          const val = calculateValuation({
            location: prop.location,
            area_type: prop.area_type,
            total_sqft: prop.total_sqft,
            bhk: prop.bhk,
            bathrooms: prop.bathrooms,
            balconies: prop.balconies,
          });
          aiEstimate = val.predicted_price_lakhs;
        }
      }

      // listings table requires location, area_type, total_sqft, bhk, bathrooms
      if (!propDetails) {
        return "Please provide a property_id from your portfolio so I can fill in the required property details for the listing.";
      }

      const listing = {
        user_id: user.id,
        property_id: property_id ?? null,
        title,
        listing_type,
        location: propDetails.location,
        area_type: propDetails.area_type,
        total_sqft: propDetails.total_sqft,
        bhk: propDetails.bhk,
        bathrooms: propDetails.bathrooms,
        balconies: propDetails.balconies ?? 0,
        asking_price_lakhs: asking_price_lakhs ?? null,
        monthly_rent: monthly_rent ?? null,
        description: description ?? null,
        contact_email: contact_email ?? user.email,
        ai_estimated_price_lakhs: aiEstimate,
        is_active: true,
      };

      const { data, error } = await supabase
        .from("listings")
        .insert(listing)
        .select()
        .single();

      if (error) return `Error creating listing: ${error.message}`;

      return JSON.stringify({
        success: true,
        listing_id: data.id,
        title,
        listing_type,
        asking_price_lakhs,
        ai_estimated_price_lakhs: aiEstimate,
        message: "Listing created successfully and is now live on the marketplace.",
      }, null, 2);
    },
  });

  const checkRera = new DynamicStructuredTool({
    name: "check_rera",
    description:
      "Checks if a project is RERA registered by searching the Karnataka RERA registry by project name, developer, or location.",
    schema: z.object({
      query: z.string().describe("Project name, developer, or location to search"),
    }),
    async func({ query }) {
      const fuse = new Fuse(reraProjects, {
        keys: ["project_name", "rera_number", "developer", "location"],
        threshold: 0.4,
        includeScore: true,
      });

      const results = fuse.search(query).slice(0, 5).map((r) => r.item);

      if (results.length === 0) {
        return `No RERA registered projects found matching "${query}". This does not necessarily mean the project is unregistered — it may not be in our database.`;
      }

      return JSON.stringify({ query, results }, null, 2);
    },
  });

  // ─── Tool 8: Portfolio Health ──────────────────────────────────────────────
  const getPortfolioHealth = new DynamicStructuredTool({
    name: "get_portfolio_health",
    description:
      "Scores the user's overall portfolio health across 4 dimensions: diversification (spread across localities), yield (rental income vs benchmark), appreciation momentum (1Y price growth), and liquidity (% in high-demand areas). Returns a 0–100 score with breakdown.",
    schema: z.object({}),
    async func() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return "User is not authenticated.";

      const { data, error } = await supabase.from("properties").select("*");
      if (error) return `Error: ${error.message}`;
      if (!data || data.length === 0) return "No properties in portfolio.";

      const localities = new Set(data.map((p: Record<string, unknown>) => p.location as string));
      const diversificationScore = Math.min((localities.size / 4) * 100, 100);

      const avgYield = data.reduce((s: number, p: Record<string, unknown>) => {
        return s + (YIELDS[p.location as string]?.net_yield_pct ?? 2.5);
      }, 0) / data.length;
      const yieldScore = Math.min((avgYield / 3.1) * 100, 100);

      const avgAppreciation = data.reduce((s: number, p: Record<string, unknown>) => {
        return s + (YIELDS[p.location as string]?.appreciation_1y_pct ?? 5);
      }, 0) / data.length;
      const appreciationScore = Math.min((avgAppreciation / 10) * 100, 100);

      const highDemand = data.filter((p: Record<string, unknown>) =>
        YIELDS[p.location as string]?.rental_demand === "High"
      ).length;
      const liquidityScore = data.length > 0 ? (highDemand / data.length) * 100 : 0;

      const overall = Math.round(
        diversificationScore * 0.25 + yieldScore * 0.30 +
        appreciationScore * 0.25 + liquidityScore * 0.20
      );

      return JSON.stringify({
        overall_score: overall,
        verdict: overall >= 75 ? "Healthy" : overall >= 50 ? "Needs attention" : "At risk",
        breakdown: {
          diversification: { score: Math.round(diversificationScore), localities_count: localities.size, note: "4+ different localities = 100" },
          yield: { score: Math.round(yieldScore), avg_net_yield_pct: avgYield.toFixed(2), benchmark_pct: "3.1" },
          appreciation: { score: Math.round(appreciationScore), avg_1y_appreciation_pct: avgAppreciation.toFixed(1) },
          liquidity: { score: Math.round(liquidityScore), high_demand_properties: highDemand, total_properties: data.length },
        },
      }, null, 2);
    },
  });

  // ─── Tool 9: Sell Recommendation ──────────────────────────────────────────
  const getSellRecommendation = new DynamicStructuredTool({
    name: "get_sell_recommendation",
    description:
      "Analyses which properties in the user's portfolio are candidates for selling vs holding. Sell signals: >40% appreciation + low yield + declining sentiment. Hold signals: strong 1Y momentum, improving sentiment, above-average yield.",
    schema: z.object({
      property_id: z.string().optional().describe("Analyse a specific property by ID. If omitted, analyses all portfolio properties."),
    }),
    async func({ property_id }) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return "User is not authenticated.";

      const query = supabase.from("properties").select("*");
      const { data, error } = property_id
        ? await query.eq("id", property_id)
        : await query;

      if (error) return `Error: ${error.message}`;
      if (!data || data.length === 0) return "No properties found.";

      const recommendations = (data as Record<string, unknown>[]).map((p) => {
        const loc = p.location as string;
        const yieldData = YIELDS[loc];
        const sent = SENTIMENT[loc];
        const val = calculateValuation({
          location: loc,
          area_type: (p.area_type as string) ?? "Super built-up Area",
          total_sqft: p.total_sqft as number,
          bhk: p.bhk as number,
          bathrooms: (p.bathrooms as number) ?? 2,
          balconies: (p.balconies as number) ?? 1,
        });

        const purchasePrice = p.purchase_price_lakhs as number;
        const gainPct = ((val.predicted_price_lakhs - purchasePrice) / purchasePrice) * 100;

        const sellSignals: string[] = [];
        if (gainPct > 40) sellSignals.push(`+${gainPct.toFixed(0)}% appreciation — strong exit opportunity`);
        if ((yieldData?.net_yield_pct ?? 3) < 2.5) sellSignals.push(`Low net yield ${yieldData?.net_yield_pct?.toFixed(2) ?? "~2.5"}% (below 2.5% threshold)`);
        if (sent?.trend === "down") sellSignals.push("Declining area sentiment — momentum may be fading");

        const holdSignals: string[] = [];
        if ((yieldData?.appreciation_1y_pct ?? 5) > 8) holdSignals.push(`Strong 1Y price momentum +${yieldData?.appreciation_1y_pct}%`);
        if (sent?.trend === "up") holdSignals.push("Improving sentiment — infrastructure development incoming");
        if ((yieldData?.net_yield_pct ?? 3) > 3.5) holdSignals.push(`Above-average yield ${yieldData?.net_yield_pct}%`);

        const recommendation = sellSignals.length >= 2 ? "CONSIDER SELLING"
          : holdSignals.length >= 2 ? "HOLD"
          : "NEUTRAL";

        return {
          name: p.name,
          location: loc,
          purchase_price_lakhs: purchasePrice,
          current_estimated_value_lakhs: val.predicted_price_lakhs,
          gain_pct: gainPct.toFixed(1),
          recommendation,
          sell_signals: sellSignals,
          hold_signals: holdSignals,
        };
      });

      return JSON.stringify(recommendations, null, 2);
    },
  });

  // ─── Tool 10: Locality Deep Dive ──────────────────────────────────────────
  const getLocalityDeepDive = new DynamicStructuredTool({
    name: "get_locality_deep_dive",
    description:
      "Returns a comprehensive profile of a single Bangalore locality: current ₹/sqft, BHK medians, price history (last 6 periods), rental yield, net yield, 5Y appreciation, sentiment score + trend + development highlights, and PropIQ investment score. Use this when the user asks about a specific locality.",
    schema: z.object({
      locality: z.string().describe("Locality name (e.g. Koramangala, Whitefield, Devanahalli)"),
    }),
    async func({ locality }) {
      // Fuzzy name match against known localities
      const known = Object.keys(HISTORY);
      const match = known.find((k) => k.toLowerCase() === locality.toLowerCase())
        ?? known.find((k) => k.toLowerCase().includes(locality.toLowerCase()))
        ?? known.find((k) => locality.toLowerCase().includes(k.toLowerCase()));

      if (!match) return `No data found for "${locality}". Known localities include: ${known.slice(0, 10).join(", ")}...`;

      const stats = marketStats.localities.find((l) => l.name.toLowerCase() === match.toLowerCase());
      const yld = YIELDS[match];
      const sent = SENTIMENT[match];
      const hist = HISTORY[match];
      const score = calculateScore(match);

      // Last 6 periods
      const last6Periods = PERIODS.slice(-6);
      const last6Prices = hist ? hist.slice(-6) : [];

      return JSON.stringify({
        locality: match,
        market: stats ?? { note: "Not in top-20 market_stats, using price history data" },
        current_price_per_sqft: hist ? hist[hist.length - 1] : null,
        price_history_last_6: last6Periods.map((p, i) => ({ period: p, price_per_sqft: last6Prices[i] })),
        rental_yield: yld ?? null,
        sentiment: sent ?? null,
        investment_score: {
          score: score.score,
          grade: score.grade,
          components: score.components,
        },
      }, null, 2);
    },
  });

  // ─── Tool 11: Compare Localities ──────────────────────────────────────────
  const compareLocalities = new DynamicStructuredTool({
    name: "compare_localities",
    description:
      "Side-by-side comparison of 2–3 Bangalore localities. Returns price/sqft, 2BHK median, net yield, 5Y appreciation, sentiment trend, and PropIQ investment score for each. Recommends the best for investors or end-users.",
    schema: z.object({
      localities: z.array(z.string()).min(2).max(3).describe("2 or 3 locality names to compare"),
      buyer_profile: z.enum(["investor", "end_user"]).optional().default("investor").describe("investor = highest score wins; end_user = lowest entry price wins"),
    }),
    async func({ localities, buyer_profile }) {
      const profiles = localities.map((name) => {
        const known = Object.keys(HISTORY);
        const match = known.find((k) => k.toLowerCase() === name.toLowerCase())
          ?? known.find((k) => k.toLowerCase().includes(name.toLowerCase()))
          ?? name;

        const stats = marketStats.localities.find((l) => l.name.toLowerCase() === match.toLowerCase());
        const yld = YIELDS[match];
        const sent = SENTIMENT[match];
        const hist = HISTORY[match];
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
        reason: buyer_profile === "end_user"
          ? "Lowest entry price per sqft for end-users"
          : "Highest PropIQ Investment Score for investors",
      }, null, 2);
    },
  });

  // ─── Tool 12: Evaluate Deal ───────────────────────────────────────────────
  const evaluateDeal = new DynamicStructuredTool({
    name: "evaluate_deal",
    description:
      "Evaluates whether a property's asking price is a good deal vs AI fair market value. Use this when a user shares a listing price and wants to know if it's worth it.",
    schema: z.object({
      location: z.string().describe("Locality in Bangalore"),
      bhk: z.number().describe("Number of bedrooms"),
      total_sqft: z.number().describe("Total area in sqft"),
      asking_price_lakhs: z.number().describe("Listed asking price in lakhs"),
      area_type: z.string().optional().default("Super built-up Area"),
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

      const yld = YIELDS[location];
      const sent = SENTIMENT[location];
      const overUnderPct = ((asking_price_lakhs - val.predicted_price_lakhs) / val.predicted_price_lakhs) * 100;

      const verdict = overUnderPct <= -7 ? "🟢 GOOD DEAL"
        : overUnderPct <= 5 ? "🟡 FAIR PRICE"
        : "🔴 OVERPRICED";

      const estimatedMonthlyRent = yld
        ? Math.round((asking_price_lakhs * 100000 * (yld.net_yield_pct / 100)) / 12)
        : null;

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
        note: "Fair value ± 5% is considered a fair deal. Below −7% = good deal.",
      }, null, 2);
    },
  });

  return [
    getPortfolio,
    getPortfolioSummary,
    getValuation,
    getMarketStats,
    findBestLocalities,
    createListing,
    checkRera,
    getPortfolioHealth,
    getSellRecommendation,
    getLocalityDeepDive,
    compareLocalities,
    evaluateDeal,
  ];
}
