export const runtime = "nodejs";

import { NextRequest } from "next/server";
import Groq from "groq-sdk";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { resolveOrgContext } from "@/lib/auth/middleware";
import { createAllTools } from "@/lib/agents/supervisor";

// llama-3.3-70b-versatile = best quality (use in production with paid tier)
// llama-3.1-8b-instant    = free tier: 500K TPD, fast, good tool calling
const MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

// ── System prompt per agent intent ───────────────────────────
const BASE_PROMPT = `You are PropIQ Copilot, an AI assistant for real estate professionals in India.

You can help with:
- Real estate portfolio management and investment analysis
- Bangalore market intelligence (51 localities, prices, yields, investment scores)
- CRM: managing contacts (leads, clients, contractors, vendors), deals, and sales pipeline
- Project management: tracking construction projects, tasks, timelines, and budgets
- Property valuation, deal evaluation, and RERA checks

For greetings, introductions, or capability questions — respond directly with NO tool calls.
For real estate queries — call the appropriate tool before answering; never answer from memory.
Format prices in Indian notation: ₹XL for lakhs (e.g. ₹85L), ₹X Cr for crores.
Keep responses concise and actionable.`;

const INTENT_PROMPTS: Record<string, string> = {
  crm: `You are PropIQ's CRM assistant. Focus on contacts, deals, pipeline stages, and activities.
Always call search_contacts, list_deals, or get_pipeline_forecast when answering CRM questions.
When creating entities, confirm key details in your response.`,

  pm: `You are PropIQ's Project Manager AI. Focus on projects, tasks, timelines, and budgets.
For overdue or blocked task queries, call get_overdue_alerts — do NOT call list_tasks.
For project listing queries, call list_projects.
For task listing queries (not overdue), call list_tasks.`,

  portfolio: `You are PropIQ's portfolio analyst. Focus on portfolio health, returns, and sell/hold decisions.
Always call get_portfolio_health or get_sell_recommendation when the user asks about holdings.`,

  market: `You are PropIQ's Bangalore market intelligence specialist.
Use get_locality_deep_dive for specific locality queries and compare_localities for comparisons.
When the user says "add X", "also show X", or "what about X" — call get_locality_deep_dive immediately.`,

  deal: `You are PropIQ's deal evaluation expert.
Always call evaluate_deal when given a property price, size, and location.`,
};

function detectIntent(message: string): string {
  const m = message.toLowerCase();
  // Deal evaluation — check first (specific property price questions)
  if (/is it.*worth|good deal|fair price|overpriced|price.*good|asking.*price|sqft.*lakh|lakh.*sqft|\d+\s*bhk.*\d+\s*lakh|\d+\s*lakh.*bhk/.test(m)) return "deal";
  // Portfolio — personal holdings
  if (/my propert|my holding|portfolio|sell.*hold|hold.*sell|gain|loss|return|health.*portfolio/.test(m)) return "portfolio";
  // PM — construction/project signals (no "deal" keyword overlap)
  if (/\bproject\b|task|assign|due date|deadline|overdue|blocked|construction|timeline|expense|milestone|budget.*project/.test(m)) return "pm";
  // CRM — contacts/pipeline (use "pipeline" not "deal" to avoid conflict)
  if (/\bcontact\b|lead|pipeline|stage|prospect|follow.?up|\bcrm\b|my deals|list.*deal|show.*deal/.test(m)) return "crm";
  // Market — default for most real estate questions
  return "market";
}

function buildSystemPrompt(message: string): string {
  const intent  = detectIntent(message);
  const prefix  = INTENT_PROMPTS[intent] ?? "";
  return prefix ? `${prefix}\n\n${BASE_PROMPT}` : BASE_PROMPT;
}

// ── Build OpenAI-format tool specs from LangChain tools ──────
function buildToolSpecs(tools: ReturnType<typeof createAllTools>) {
  return tools.map((tool) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schema = (tool as any).schema as z.ZodTypeAny;
    let parameters: Record<string, unknown> = { type: "object", properties: {} };

    try {
      // Zod 4 has a built-in toJSONSchema that correctly handles optional/default fields
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const jsonSchema = (z as any).toJSONSchema(schema) as Record<string, unknown>;
      // Strip $schema and additionalProperties (8B model often passes extra fields)
      const { $schema: _s, additionalProperties: _ap, ...cleanSchema } = jsonSchema;

      // Fields with defaults are optional to the caller — remove them from required
      if (Array.isArray(cleanSchema.required) && cleanSchema.properties && typeof cleanSchema.properties === "object") {
        const props = cleanSchema.properties as Record<string, Record<string, unknown>>;
        cleanSchema.required = (cleanSchema.required as string[]).filter(
          (field) => field in props && !("default" in props[field])
        );
        if ((cleanSchema.required as string[]).length === 0) delete cleanSchema.required;
      }

      // Remove minItems/maxItems on arrays — 8B model sometimes passes wrong count
      if (cleanSchema.properties && typeof cleanSchema.properties === "object") {
        for (const v of Object.values(cleanSchema.properties as Record<string, Record<string, unknown>>)) {
          if (v.type === "array") { delete v.minItems; delete v.maxItems; }
        }
      }

      // Empty-schema tools: ensure there's always at least a properties object so
      // the model doesn't generate null args (which Groq rejects)
      if (!cleanSchema.properties || Object.keys(cleanSchema.properties as object).length === 0) {
        cleanSchema.properties = {};
        delete cleanSchema.required;
      }

      parameters = cleanSchema;
    } catch {
      // fallback to empty schema
    }

    return {
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters,
      },
    };
  });
}

// ── Chart event builder ───────────────────────────────────────
type ChartData = {
  type: "bar" | "line" | "grouped_bar";
  title: string;
  data: Record<string, unknown>[];
  xKey: string;
  yKeys: string[];
  colors?: string[];
  unit?: string;
};

function buildChartEvent(toolName: string, result: string): { type: "chart"; chart: ChartData } | null {
  try {
    const parsed = JSON.parse(result);

    if (toolName === "get_portfolio_health" && parsed.breakdown) {
      const { diversification, yield: yld, appreciation, liquidity } = parsed.breakdown;
      return {
        type: "chart",
        chart: {
          type: "bar",
          title: `Portfolio Health — ${parsed.overall_score}/100`,
          data: [
            { dimension: "Diversification", score: diversification.score },
            { dimension: "Yield",           score: yld.score },
            { dimension: "Appreciation",    score: appreciation.score },
            { dimension: "Liquidity",       score: liquidity.score },
          ],
          xKey: "dimension", yKeys: ["score"], colors: ["#6366f1"], unit: "/100",
        },
      };
    }

    if (toolName === "get_sell_recommendation" && Array.isArray(parsed) && parsed.length > 0) {
      return {
        type: "chart",
        chart: {
          type: "bar",
          title: "Property Appreciation Gains",
          data: parsed.map((p: Record<string, unknown>) => ({
            name: String(p.name ?? "").split(" ").slice(0, 2).join(" "),
            "Gain %": parseFloat(String(p.gain_pct ?? "0")),
          })),
          xKey: "name", yKeys: ["Gain %"], colors: ["#10b981"], unit: "%",
        },
      };
    }

    if (toolName === "get_portfolio_summary" && parsed.properties_ranked_by_gain) {
      return {
        type: "chart",
        chart: {
          type: "grouped_bar",
          title: "Portfolio — Invested vs Current Value (₹L)",
          data: (parsed.properties_ranked_by_gain as Record<string, unknown>[]).map((p) => ({
            name:     String(p.name ?? "").split(" ").slice(0, 2).join(" "),
            Invested: p.purchase_price_lakhs,
            Current:  p.current_value_lakhs,
          })),
          xKey: "name", yKeys: ["Invested", "Current"], colors: ["#94a3b8", "#6366f1"], unit: "L",
        },
      };
    }

    if (toolName === "get_locality_deep_dive" && Array.isArray(parsed.price_history_last_6)) {
      return {
        type: "chart",
        chart: {
          type: "line",
          title: `${parsed.locality} — Price Trend`,
          data: (parsed.price_history_last_6 as Record<string, unknown>[]).map((h) => ({
            period: h.period, "₹/sqft": h.price_per_sqft,
          })),
          xKey: "period", yKeys: ["₹/sqft"], colors: ["#6366f1"], unit: "₹/sqft",
        },
      };
    }

    if (toolName === "compare_localities" && Array.isArray(parsed.comparison)) {
      const locs = parsed.comparison as Record<string, unknown>[];
      const locNames = locs.map((l) => String(l.locality));
      return {
        type: "chart",
        chart: {
          type: "grouped_bar",
          title: locNames.join(" vs "),
          data: [
            { metric: "Inv. Score",  ...Object.fromEntries(locs.map((l) => [l.locality, l.investment_score])) },
            { metric: "Net Yield %", ...Object.fromEntries(locs.map((l) => [l.locality, l.net_yield_pct])) },
            { metric: "5Y Appre %",  ...Object.fromEntries(locs.map((l) => [l.locality, l.appreciation_5y_pct])) },
          ],
          xKey: "metric", yKeys: locNames, colors: ["#6366f1", "#10b981", "#f59e0b"],
        },
      };
    }

    if (toolName === "evaluate_deal" && parsed.asking_price_lakhs != null) {
      return {
        type: "chart",
        chart: {
          type: "bar",
          title: "Deal Evaluation (₹L)",
          data: [
            { label: "Asking",      value: parsed.asking_price_lakhs },
            { label: "AI Value",    value: parsed.ai_fair_value_lakhs },
            { label: "Lower Bound", value: parsed.price_range?.lower },
            { label: "Upper Bound", value: parsed.price_range?.upper },
          ].filter((d) => d.value != null),
          xKey: "label", yKeys: ["value"], colors: ["#f59e0b", "#6366f1", "#94a3b8", "#94a3b8"], unit: "L",
        },
      };
    }

    if (toolName === "get_pipeline_forecast" && parsed.by_stage) {
      return {
        type: "chart",
        chart: {
          type: "bar",
          title: `Pipeline Forecast — ₹${parsed.weighted_forecast_lakhs}L weighted`,
          data: (parsed.by_stage as Record<string, unknown>[]).map((s) => ({
            stage:    s.stage,
            "Total ₹L":    s.total_lakhs,
            "Weighted ₹L": s.weighted_lakhs,
          })),
          xKey: "stage", yKeys: ["Total ₹L", "Weighted ₹L"], colors: ["#94a3b8", "#6366f1"], unit: "L",
        },
      };
    }

    if (toolName === "get_project_timeline" && parsed.tasks) {
      const s = parsed.tasks.by_status;
      return {
        type: "chart",
        chart: {
          type: "bar",
          title: `${parsed.project} — Task Status`,
          data: [
            { status: "Todo",        count: s.todo },
            { status: "In Progress", count: s.in_progress },
            { status: "Review",      count: s.review },
            { status: "Blocked",     count: s.blocked },
            { status: "Done",        count: s.done },
          ],
          xKey: "status", yKeys: ["count"], colors: ["#94a3b8"], unit: " tasks",
        },
      };
    }
  } catch {
    // Not JSON or tool not chart-worthy
  }
  return null;
}

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
};

// ── Main handler ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const { messages: incomingMessages } = await request.json() as {
    messages: Array<{ role: string; content: string }>;
  };

  const supabase = createSupabaseServerClient(request);

  // Resolve org context (falls back gracefully for unauthenticated users)
  const orgCtx = await resolveOrgContext(supabase);
  const organizationId = orgCtx?.organizationId ?? "00000000-0000-0000-0000-000000000000";
  const locale = orgCtx?.locale ?? "en";

  // Build ALL tools (used as executor map — we subset per intent for LLM calls)
  const allTools = createAllTools(supabase, organizationId);

  // Build tool executor map from all tools
  const toolMap: Record<string, (args: Record<string, unknown>) => Promise<string>> = {};
  for (const tool of allTools) {
    const t = tool;
    toolMap[t.name] = async (args) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (t as any).invoke(args);
        return typeof result === "string" ? result : JSON.stringify(result);
      } catch (e) {
        return `Tool error: ${e instanceof Error ? e.message : String(e)}`;
      }
    };
  }

  // Tool subsets per intent — keeps Groq context small and avoids schema conflicts
  const TOOL_NAMES_BY_INTENT: Record<string, string[]> = {
    market:    ["get_valuation","get_market_stats","find_best_localities","get_locality_deep_dive","compare_localities","evaluate_deal"],
    deal:      ["evaluate_deal","get_valuation","check_rera","create_listing"],
    portfolio: ["get_portfolio","get_portfolio_summary","get_portfolio_health","get_sell_recommendation"],
    pm:        ["list_projects","create_project","update_project_status","list_tasks","create_task","update_task","get_project_timeline","get_overdue_alerts"],
    crm:       ["search_contacts","create_contact","list_deals","create_deal","move_deal_stage","log_activity","get_pipeline_forecast"],
  };
  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const lastUserMessage = [...incomingMessages].reverse().find((m) => m.role === "user")?.content ?? "";
        const intent = detectIntent(lastUserMessage);
        const systemPrompt = buildSystemPrompt(lastUserMessage);

        const localeInstructions: Record<string, string> = {
          hi: " Respond in Hindi (Devanagari script).",
          kn: " Respond in Kannada (Kannada script).",
          ta: " Respond in Tamil (Tamil script).",
          te: " Respond in Telugu (Telugu script).",
          mr: " Respond in Marathi (Devanagari script).",
        };
        const fullSystemPrompt = systemPrompt + (localeInstructions[locale] ?? "");

        // Only pass the relevant tool subset to the LLM for this intent
        const intentToolNames = TOOL_NAMES_BY_INTENT[intent] ?? TOOL_NAMES_BY_INTENT.market;
        const intentTools = allTools.filter((t) => intentToolNames.includes(t.name));
        const TOOL_SPECS = buildToolSpecs(intentTools);

        const messages: ChatMessage[] = [
          { role: "system", content: fullSystemPrompt },
          ...incomingMessages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        ];

        // ReAct loop — max 5 tool-call rounds with true LLM streaming
        for (let round = 0; round < 5; round++) {
          const toolCallAcc: Record<number, { id: string; name: string; args: string }> = {};
          let assistantContent = "";

          const iter = await client.chat.completions.create({
            model: MODEL,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            messages: messages as any,
            tools: TOOL_SPECS,
            tool_choice: "auto",
            max_tokens: 2048,
            stream: true,
          });

          for await (const chunk of iter) {
            const choice = chunk.choices[0];
            if (!choice) continue;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const delta = (choice as any).delta ?? {};

            if (delta.content) {
              const clean = delta.content.replace(/<\/?tool_(?:call|response)[^>]*>/gi, "");
              if (clean) {
                assistantContent += clean;
                send({ type: "token", content: clean });
              }
            }

            if (delta.tool_calls && Array.isArray(delta.tool_calls)) {
              for (const tc of delta.tool_calls) {
                const idx: number = tc.index ?? 0;
                if (!toolCallAcc[idx]) {
                  toolCallAcc[idx] = { id: tc.id ?? `call_${idx}`, name: "", args: "" };
                }
                if (tc.id) toolCallAcc[idx].id = tc.id;
                if (tc.function?.name && !toolCallAcc[idx].name) {
                  toolCallAcc[idx].name = tc.function.name;
                  send({ type: "tool_start", tool: tc.function.name });
                }
                if (tc.function?.arguments) {
                  toolCallAcc[idx].args += tc.function.arguments;
                }
              }
            }
          }

          const toolCalls = Object.values(toolCallAcc).filter((tc) => tc.name);

          if (toolCalls.length === 0) break;

          messages.push({
            role: "assistant",
            content: assistantContent,
            tool_calls: toolCalls.map((tc) => ({
              id: tc.id, type: "function" as const,
              function: { name: tc.name, arguments: tc.args },
            })),
          });

          const toolResults: string[] = [];
          for (const tc of toolCalls) {
            let args: Record<string, unknown> = {};
            try {
              const parsed = JSON.parse(tc.args);
              args = (parsed && typeof parsed === "object" && !Array.isArray(parsed)) ? parsed : {};
            } catch { args = {}; }
            // 8B model sometimes serialises numbers/booleans as strings — coerce them back
            for (const [k, v] of Object.entries(args)) {
              if (typeof v === "string") {
                const t = v.trim();
                if (/^-?\d+(\.\d+)?$/.test(t)) args[k] = parseFloat(t);
                else if (t === "true")  args[k] = true;
                else if (t === "false") args[k] = false;
              }
            }

            const executor = toolMap[tc.name];
            const result   = executor ? await executor(args) : `Unknown tool: ${tc.name}`;
            toolResults.push(result);

            const chartEvent = buildChartEvent(tc.name, result);
            if (chartEvent) send(chartEvent);

            send({ type: "tool_end", tool: tc.name });

            messages.push({ role: "tool", content: result, tool_call_id: tc.id });
          }

          // If all tool results are empty/errors, force one final text-only response to stop looping
          const allEmpty = toolResults.every((r) =>
            /^No .+ found\.|^Error:|^Unknown tool/.test(r) || r.trim() === ""
          );
          if (allEmpty) {
            const finalIter = await client.chat.completions.create({
              model: MODEL,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              messages: messages as any,
              max_tokens: 512,
              stream: true,
            });
            for await (const chunk of finalIter) {
              const content = chunk.choices[0]?.delta?.content;
              if (content) send({ type: "token", content });
            }
            break;
          }
        }

        send({ type: "done" });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("[chat] error:", message);
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
