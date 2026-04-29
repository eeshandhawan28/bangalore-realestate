import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseClient } from "@supabase/supabase-js";

export function createCrmTools(supabase: SupabaseClient, organizationId: string) {
  const searchContacts = new DynamicStructuredTool({
    name: "search_contacts",
    description: "Search and list CRM contacts by name, type, or tag. Use this to find leads, clients, contractors, or vendors.",
    schema: z.object({
      query:     z.string().optional().describe("Search by name, email, or company"),
      type:      z.enum(["lead","client","contractor","vendor","investor","government"]).optional(),
      assigned_to_me: z.boolean().optional().describe("If true, only return contacts assigned to me"),
      limit:     z.number().optional().default(10),
    }),
    async func({ query, type, assigned_to_me, limit }) {
      const { data: { user } } = await supabase.auth.getUser();
      let q = supabase.from("contacts").select("id,type,first_name,last_name,company,email,phone,whatsapp,tags,assigned_to,created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(limit ?? 10);

      if (type) q = q.eq("type", type);
      if (assigned_to_me && user) q = q.eq("assigned_to", user.id);
      if (query) q = q.or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,company.ilike.%${query}%,email.ilike.%${query}%`);

      const { data, error } = await q;
      if (error) return `Error: ${error.message}`;
      if (!data || data.length === 0) return "No contacts found.";
      return JSON.stringify(data, null, 2);
    },
  });

  const createContact = new DynamicStructuredTool({
    name: "create_contact",
    description: "Create a new CRM contact (lead, client, contractor, vendor, investor, or government).",
    schema: z.object({
      type:       z.enum(["lead","client","contractor","vendor","investor","government"]).default("lead"),
      first_name: z.string(),
      last_name:  z.string().optional(),
      company:    z.string().optional(),
      email:      z.string().optional(),
      phone:      z.string().optional(),
      whatsapp:   z.string().optional(),
      city:       z.string().optional(),
      source:     z.string().optional().describe("Where did this contact come from? e.g. referral, website, magicbricks"),
      tags:       z.array(z.string()).optional(),
    }),
    async func({ type, first_name, last_name, company, email, phone, whatsapp, city, source, tags }) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return "User is not authenticated.";
      const { data, error } = await supabase.from("contacts").insert({
        organization_id: organizationId,
        type, first_name, last_name, company, email, phone, whatsapp, city, source,
        tags: tags ?? [],
        assigned_to: user.id,
        created_by: user.id,
      }).select("id,first_name,last_name,type").single();
      if (error) return `Error: ${error.message}`;
      return JSON.stringify({ success: true, contact_id: data.id,
        message: `Created ${type} contact: ${data.first_name} ${data.last_name ?? ""}`.trim() }, null, 2);
    },
  });

  const listDeals = new DynamicStructuredTool({
    name: "list_deals",
    description: "List deals in the pipeline. Can filter by stage, assigned user, or search by title.",
    schema: z.object({
      pipeline_name: z.string().optional().describe("Filter by pipeline name, e.g. 'Sales Pipeline'"),
      stage_name:    z.string().optional().describe("Filter by stage name, e.g. 'Negotiation'"),
      assigned_to_me: z.boolean().optional(),
      limit:          z.number().optional().default(10),
    }),
    async func({ pipeline_name, stage_name, assigned_to_me, limit }) {
      const { data: { user } } = await supabase.auth.getUser();
      let q = supabase.from("deals")
        .select(`id,title,value_lakhs,expected_close,probability,assigned_to,stage_id,created_at,
          pipeline_stages(name,color,win_probability),
          contacts(first_name,last_name,company)`)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(limit ?? 10);

      if (assigned_to_me && user) q = q.eq("assigned_to", user.id);

      const { data, error } = await q;
      if (error) return `Error: ${error.message}`;
      if (!data || data.length === 0) return "No deals found.";

      let results = data;
      if (stage_name) {
        results = results.filter((d) => {
          const stage = d.pipeline_stages as { name?: string } | null;
          return stage?.name?.toLowerCase().includes(stage_name.toLowerCase());
        });
      }
      return JSON.stringify(results, null, 2);
    },
  });

  const createDeal = new DynamicStructuredTool({
    name: "create_deal",
    description: "Create a new deal in the CRM pipeline.",
    schema: z.object({
      title:          z.string().describe("Deal title, e.g. '3BHK Sale — Whitefield'"),
      value_lakhs:    z.number().optional(),
      contact_id:     z.string().optional().describe("Contact ID to link to this deal"),
      expected_close: z.string().optional().describe("Expected close date (YYYY-MM-DD)"),
      notes:          z.string().optional(),
    }),
    async func({ title, value_lakhs, contact_id, expected_close, notes }) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return "User is not authenticated.";

      // Get default pipeline and first stage
      const { data: pipeline } = await supabase.from("pipelines")
        .select("id").eq("organization_id", organizationId).eq("is_default", true).single();
      if (!pipeline) return "No default pipeline found. Please create a pipeline first.";

      const { data: stage } = await supabase.from("pipeline_stages")
        .select("id").eq("pipeline_id", pipeline.id).order("position").limit(1).single();
      if (!stage) return "No pipeline stages found.";

      const { data, error } = await supabase.from("deals").insert({
        organization_id: organizationId,
        pipeline_id: pipeline.id,
        stage_id: stage.id,
        title, value_lakhs, contact_id, notes,
        expected_close: expected_close ?? null,
        assigned_to: user.id,
        created_by: user.id,
      }).select("id,title,value_lakhs").single();
      if (error) return `Error: ${error.message}`;
      return JSON.stringify({ success: true, deal_id: data.id, title: data.title,
        message: `Deal created in 'Prospecting' stage.` }, null, 2);
    },
  });

  const moveDealStage = new DynamicStructuredTool({
    name: "move_deal_stage",
    description: "Move a deal to a different pipeline stage (e.g. from Prospecting to Proposal).",
    schema: z.object({
      deal_id:    z.string(),
      stage_name: z.string().describe("Target stage name, e.g. 'Negotiation', 'Closed Won'"),
      note:       z.string().optional().describe("Optional note to log with this stage change"),
    }),
    async func({ deal_id, stage_name, note }) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return "User is not authenticated.";

      // Find stage by name in the deal's pipeline
      const { data: deal } = await supabase.from("deals").select("pipeline_id,stage_id,title").eq("id", deal_id).single();
      if (!deal) return `Deal ${deal_id} not found.`;

      const { data: stages } = await supabase.from("pipeline_stages")
        .select("id,name").eq("pipeline_id", deal.pipeline_id);
      const target = (stages ?? []).find((s) => s.name.toLowerCase().includes(stage_name.toLowerCase()));
      if (!target) return `Stage "${stage_name}" not found. Available stages: ${(stages ?? []).map((s) => s.name).join(", ")}`;

      const { error } = await supabase.from("deals").update({ stage_id: target.id, updated_at: new Date().toISOString() }).eq("id", deal_id);
      if (error) return `Error: ${error.message}`;

      // Log activity
      await supabase.from("deal_activities").insert({
        deal_id, type: "stage_change",
        content: note ?? `Moved to ${target.name}`,
        metadata: { from_stage_id: deal.stage_id, to_stage_id: target.id, to_stage_name: target.name },
        created_by: user.id,
      });

      return JSON.stringify({ success: true, deal_id, new_stage: target.name,
        message: `"${deal.title}" moved to ${target.name}.` }, null, 2);
    },
  });

  const logActivity = new DynamicStructuredTool({
    name: "log_activity",
    description: "Log an activity on a deal (note, call, email, or meeting).",
    schema: z.object({
      deal_id: z.string(),
      type:    z.enum(["note","call","email","meeting"]).default("note"),
      content: z.string().describe("Activity content or summary"),
    }),
    async func({ deal_id, type, content }) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return "User is not authenticated.";
      const { error } = await supabase.from("deal_activities").insert({
        deal_id, type, content, created_by: user.id,
      });
      if (error) return `Error: ${error.message}`;
      return JSON.stringify({ success: true, message: `${type} logged on deal.` }, null, 2);
    },
  });

  const getPipelineForecast = new DynamicStructuredTool({
    name: "get_pipeline_forecast",
    description: "Returns a weighted revenue forecast for the pipeline based on deal values and stage win probabilities.",
    schema: z.object({}),
    async func() {
      const { data, error } = await supabase.from("deals")
        .select("value_lakhs,probability,pipeline_stages(name,win_probability)")
        .eq("organization_id", organizationId)
        .not("value_lakhs", "is", null);
      if (error) return `Error: ${error.message}`;
      if (!data || data.length === 0) return "No deals with values found.";

      let totalPipeline = 0;
      let weightedForecast = 0;
      const byStage: Record<string, { count: number; total: number; weighted: number }> = {};

      for (const d of data) {
        const stage = d.pipeline_stages as { name?: string; win_probability?: number } | null;
        const prob  = (d.probability ?? stage?.win_probability ?? 0) / 100;
        const val   = d.value_lakhs as number;
        const name  = stage?.name ?? "Unknown";
        totalPipeline += val;
        weightedForecast += val * prob;
        if (!byStage[name]) byStage[name] = { count: 0, total: 0, weighted: 0 };
        byStage[name].count++;
        byStage[name].total += val;
        byStage[name].weighted += val * prob;
      }

      return JSON.stringify({
        total_pipeline_lakhs:        Math.round(totalPipeline),
        weighted_forecast_lakhs:     Math.round(weightedForecast),
        total_deals:                 data.length,
        by_stage: Object.entries(byStage).map(([name, s]) => ({
          stage: name, deals: s.count,
          total_lakhs: Math.round(s.total),
          weighted_lakhs: Math.round(s.weighted),
        })),
      }, null, 2);
    },
  });

  return [searchContacts, createContact, listDeals, createDeal, moveDealStage, logActivity, getPipelineForecast];
}
