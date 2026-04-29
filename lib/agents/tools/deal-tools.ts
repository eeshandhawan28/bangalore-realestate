import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseClient } from "@supabase/supabase-js";
import { calculateValuation } from "@/lib/valuation";
import reraProjects from "@/lib/data/rera_projects.json";
import Fuse from "fuse.js";

export function createDealTools(supabase: SupabaseClient) {
  const createListing = new DynamicStructuredTool({
    name: "create_listing",
    description: "Creates a marketplace listing for a property in the user's portfolio.",
    schema: z.object({
      property_id:         z.string().optional(),
      title:               z.string(),
      listing_type:        z.enum(["sale", "rent"]),
      asking_price_lakhs:  z.number().optional(),
      monthly_rent:        z.number().optional(),
      description:         z.string().optional(),
      contact_email:       z.string().optional(),
    }),
    async func({ property_id, title, listing_type, asking_price_lakhs, monthly_rent, description, contact_email }) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return "User is not authenticated.";
      if (!property_id) return "Please provide a property_id from your portfolio.";
      const { data: prop } = await supabase.from("properties").select("*").eq("id", property_id).single();
      if (!prop) return "Property not found.";
      const val = calculateValuation({
        location: prop.location, area_type: prop.area_type,
        total_sqft: prop.total_sqft, bhk: prop.bhk,
        bathrooms: prop.bathrooms, balconies: prop.balconies,
      });
      const { data, error } = await supabase.from("listings").insert({
        user_id: user.id, property_id, title, listing_type,
        location: prop.location, area_type: prop.area_type,
        total_sqft: prop.total_sqft, bhk: prop.bhk,
        bathrooms: prop.bathrooms, balconies: prop.balconies ?? 0,
        asking_price_lakhs: asking_price_lakhs ?? null,
        monthly_rent: monthly_rent ?? null,
        description: description ?? null,
        contact_email: contact_email ?? user.email,
        ai_estimated_price_lakhs: val.predicted_price_lakhs,
        is_active: true,
      }).select().single();
      if (error) return `Error: ${error.message}`;
      return JSON.stringify({ success: true, listing_id: data.id, title, listing_type,
        asking_price_lakhs, ai_estimated_price_lakhs: val.predicted_price_lakhs,
        message: "Listing created and is now live on the marketplace." }, null, 2);
    },
  });

  const checkRera = new DynamicStructuredTool({
    name: "check_rera",
    description: "Checks if a project is RERA registered by searching the Karnataka RERA registry.",
    schema: z.object({ query: z.string().describe("Project name, developer, or location") }),
    async func({ query }) {
      const fuse = new Fuse(reraProjects, {
        keys: ["project_name", "rera_number", "developer", "location"],
        threshold: 0.4,
        includeScore: true,
      });
      const results = fuse.search(query).slice(0, 5).map((r) => r.item);
      if (results.length === 0) return `No RERA projects found matching "${query}".`;
      return JSON.stringify({ query, results }, null, 2);
    },
  });

  return [createListing, checkRera];
}
