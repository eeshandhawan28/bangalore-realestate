import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseClient } from "@supabase/supabase-js";
import { calculateValuation } from "@/lib/valuation";
import marketStats from "@/lib/data/market_stats.json";
import reraProjects from "@/lib/data/rera_projects.json";
import Fuse from "fuse.js";

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

  return [
    getPortfolio,
    getPortfolioSummary,
    getValuation,
    getMarketStats,
    findBestLocalities,
    createListing,
    checkRera,
  ];
}
