export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { InferenceClient } from "@huggingface/inference";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createAgentTools } from "@/lib/agent/tools";

const MODEL = "Qwen/Qwen2.5-7B-Instruct";

const BASE_PROMPT = `You are PropIQ Copilot, an AI assistant specialized in Bangalore real estate.

You have access to tools to fetch the user's portfolio, run valuations, query market stats, find localities by budget, create listings, check RERA registrations, analyse portfolio health, evaluate deals, and compare localities.

ALWAYS call the appropriate tool before answering — even in follow-up messages that reference a previously mentioned locality or property. Never answer from memory if fresh tool data is available.
Format all prices in Indian notation: ₹XL for lakhs (e.g. ₹85L), ₹X Cr for crores (e.g. ₹1.2 Cr).
Keep answers concise and actionable. Market data includes Q4 2025 projections.`;

const INTENT_PROMPTS = {
  portfolio: `You are a portfolio analyst for PropIQ. Focus on portfolio health, returns, sell/hold decisions, and yield optimization. Always call get_portfolio_health or get_sell_recommendation when the user asks about their holdings.`,
  market: `You are a Bangalore market intelligence specialist for PropIQ. Focus on locality analysis, investment scores, price trends, and area comparisons. Use get_locality_deep_dive for specific area queries and compare_localities for comparisons. When the user says "add X", "also show X", "include X", or "what about X" — you MUST call get_locality_deep_dive for that new locality immediately. Never use previously seen data from conversation history — always call the tool.`,
  deal: `You are a deal evaluation expert for PropIQ. Help the user assess whether a specific property is priced fairly. Always call evaluate_deal when given a property price, size, and location.`,
  general: "",
};

function detectIntent(message: string): "portfolio" | "market" | "deal" | "general" {
  const m = message.toLowerCase();
  if (/portfolio|my propert|my holding|sell|gain|loss|return|health/.test(m)) return "portfolio";
  if (/locality|area|where.*buy|market|koramangala|whitefield|indiranagar|invest|score|trend|deep.?dive|compare|add.*nagar|add.*halli|add.*road|also show|what about/.test(m)) return "market";
  if (/listing|deal|price.*good|fair.*price|afford|is it.*worth|2bhk|3bhk|find.*flat|sqft|asking/.test(m)) return "deal";
  return "general";
}

function buildSystemPrompt(message: string): string {
  const intent = detectIntent(message);
  const prefix = INTENT_PROMPTS[intent];
  return prefix ? `${prefix}\n\n${BASE_PROMPT}` : BASE_PROMPT;
}

// OpenAI-format tool specs for the HF chat API
const TOOL_SPECS = [
  {
    type: "function" as const,
    function: {
      name: "get_portfolio",
      description: "Fetches all properties in the user's portfolio from the database.",
      parameters: {
        type: "object",
        properties: {
          include_valuations: { type: "boolean", description: "If true, run AI valuation for each property" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_portfolio_summary",
      description: "Returns total portfolio value, total invested, returns, and properties ranked by gain.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_valuation",
      description: "Estimates market value of a property given its specs.",
      parameters: {
        type: "object",
        required: ["location", "total_sqft", "bhk"],
        properties: {
          location: { type: "string" },
          total_sqft: { type: "number" },
          bhk: { type: "number" },
          bathrooms: { type: "number" },
          balconies: { type: "number" },
          area_type: { type: "string" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_market_stats",
      description: "Returns market data (price/sqft, median prices) for Bangalore localities.",
      parameters: {
        type: "object",
        properties: {
          localities: { type: "array", items: { type: "string" } },
          sort_by: { type: "string", enum: ["avg_price_per_sqft", "listing_count", "median_2bhk_lakhs"] },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "find_best_localities",
      description: "Finds best Bangalore localities to buy within a budget and BHK preference.",
      parameters: {
        type: "object",
        required: ["budget_lakhs", "bhk"],
        properties: {
          budget_lakhs: { type: "number" },
          bhk: { type: "number" },
          max_results: { type: "number" },
          sort_by: { type: "string", enum: ["affordability", "value_growth_potential"] },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_listing",
      description: "Creates a marketplace listing for a property in the user's portfolio.",
      parameters: {
        type: "object",
        required: ["title", "listing_type", "property_id"],
        properties: {
          property_id: { type: "string" },
          title: { type: "string" },
          listing_type: { type: "string", enum: ["sale", "rent"] },
          asking_price_lakhs: { type: "number" },
          monthly_rent: { type: "number" },
          description: { type: "string" },
          contact_email: { type: "string" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "check_rera",
      description: "Checks if a project is RERA registered by searching the Karnataka RERA registry.",
      parameters: {
        type: "object",
        required: ["query"],
        properties: {
          query: { type: "string" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_portfolio_health",
      description: "Scores the user's portfolio across 4 dimensions: diversification, yield, appreciation, and liquidity. Returns an overall health score with recommendations.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_sell_recommendation",
      description: "Analyses each property in the portfolio to decide whether to hold or sell based on gain %, net yield, and sentiment trend.",
      parameters: {
        type: "object",
        properties: {
          property_id: { type: "string", description: "Optional — analyse a single property by ID instead of the whole portfolio" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_locality_deep_dive",
      description: "Returns a full profile for a Bangalore locality: price/sqft, BHK medians, price history, rental yield, sentiment score, investment score, and development highlights.",
      parameters: {
        type: "object",
        required: ["locality"],
        properties: {
          locality: { type: "string", description: "Locality name, e.g. Koramangala, Whitefield, Devanahalli" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "compare_localities",
      description: "Compares 2–3 Bangalore localities side by side on price, yield, appreciation, and investment score. Recommends the best match for investor or end-user profiles.",
      parameters: {
        type: "object",
        required: ["localities"],
        properties: {
          localities: { type: "array", items: { type: "string" }, description: "2 or 3 locality names to compare" },
          buyer_profile: { type: "string", enum: ["investor", "end_user"], description: "Optimise recommendation for highest return (investor) or lowest entry price (end_user)" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "evaluate_deal",
      description: "Given a property's locality, size, BHK, and asking price, returns a verdict: GOOD DEAL, FAIR, or OVERPRICED vs the AI fair value estimate.",
      parameters: {
        type: "object",
        required: ["location", "bhk", "total_sqft", "asking_price_lakhs"],
        properties: {
          location: { type: "string" },
          bhk: { type: "number" },
          total_sqft: { type: "number" },
          asking_price_lakhs: { type: "number" },
        },
      },
    },
  },
];

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
          title: `Portfolio Health — Overall ${parsed.overall_score}/100`,
          data: [
            { dimension: "Diversification", score: diversification.score },
            { dimension: "Yield", score: yld.score },
            { dimension: "Appreciation", score: appreciation.score },
            { dimension: "Liquidity", score: liquidity.score },
          ],
          xKey: "dimension",
          yKeys: ["score"],
          colors: ["#6366f1"],
          unit: "/100",
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
          xKey: "name",
          yKeys: ["Gain %"],
          colors: ["#10b981"],
          unit: "%",
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
            name: String(p.name ?? "").split(" ").slice(0, 2).join(" "),
            Invested: p.purchase_price_lakhs,
            Current: p.current_value_lakhs,
          })),
          xKey: "name",
          yKeys: ["Invested", "Current"],
          colors: ["#94a3b8", "#6366f1"],
          unit: "L",
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
            period: h.period,
            "₹/sqft": h.price_per_sqft,
          })),
          xKey: "period",
          yKeys: ["₹/sqft"],
          colors: ["#6366f1"],
          unit: "₹/sqft",
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
            { metric: "Inv. Score", ...Object.fromEntries(locs.map((l) => [l.locality, l.investment_score])) },
            { metric: "Net Yield %", ...Object.fromEntries(locs.map((l) => [l.locality, l.net_yield_pct])) },
            { metric: "5Y Appre %", ...Object.fromEntries(locs.map((l) => [l.locality, l.appreciation_5y_pct])) },
          ],
          xKey: "metric",
          yKeys: locNames,
          colors: ["#6366f1", "#10b981", "#f59e0b"],
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
            { label: "Asking", value: parsed.asking_price_lakhs },
            { label: "AI Fair Value", value: parsed.ai_fair_value_lakhs },
            { label: "Lower Bound", value: parsed.price_range?.lower },
            { label: "Upper Bound", value: parsed.price_range?.upper },
          ].filter((d) => d.value != null),
          xKey: "label",
          yKeys: ["value"],
          colors: ["#f59e0b", "#6366f1", "#94a3b8", "#94a3b8"],
          unit: "L",
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

export async function POST(request: NextRequest) {
  const { messages: incomingMessages } = await request.json() as {
    messages: Array<{ role: string; content: string }>;
  };

  const supabase = createSupabaseServerClient(request);
  const tools = createAgentTools(supabase);

  // Build tool executor map
  const toolMap: Record<string, (args: Record<string, unknown>) => Promise<string>> = {};
  for (const tool of tools) {
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

  const client = new InferenceClient(process.env.HUGGINGFACE_API_KEY);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Build message history
        const lastUserMessage = [...incomingMessages].reverse().find((m) => m.role === "user")?.content ?? "";
        const messages: ChatMessage[] = [
          { role: "system", content: buildSystemPrompt(lastUserMessage) },
          ...incomingMessages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        ];

        // ReAct loop — max 5 tool-call rounds, true LLM streaming
        for (let round = 0; round < 5; round++) {
          console.log(`[chat] round ${round}, streaming model call`);

          // Accumulate tool call deltas across stream chunks
          const toolCallAcc: Record<number, { id: string; name: string; args: string }> = {};
          let assistantContent = "";

          const iter = client.chatCompletionStream({
            model: MODEL,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            messages: messages as any,
            tools: TOOL_SPECS,
            tool_choice: "auto",
            max_tokens: 2048,
          });

          for await (const chunk of iter) {
            const choice = chunk.choices[0];
            if (!choice) continue;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const delta = (choice as any).delta ?? {};

            // Stream text tokens directly to the client
            // Strip Qwen's internal XML tags that sometimes leak into content
            if (delta.content) {
              const clean = delta.content.replace(/<\/?tool_(?:call|response)[^>]*>/gi, "");
              if (clean) {
                assistantContent += clean;
                send({ type: "token", content: clean });
              }
            }

            // Accumulate streaming tool call deltas
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

          // No tool calls → final answer was already streamed token by token
          if (toolCalls.length === 0) break;

          // Push assistant message with tool calls into history
          messages.push({
            role: "assistant",
            content: assistantContent,
            tool_calls: toolCalls.map((tc) => ({
              id: tc.id,
              type: "function" as const,
              function: { name: tc.name, arguments: tc.args },
            })),
          });

          // Execute each tool call
          for (const tc of toolCalls) {
            let args: Record<string, unknown> = {};
            try {
              args = JSON.parse(tc.args);
            } catch {
              args = {};
            }

            const executor = toolMap[tc.name];
            const result = executor
              ? await executor(args)
              : `Unknown tool: ${tc.name}`;

            // Emit chart event if this tool produces visualisable data
            const chartEvent = buildChartEvent(tc.name, result);
            if (chartEvent) send(chartEvent);

            send({ type: "tool_end", tool: tc.name });

            messages.push({
              role: "tool",
              content: result,
              tool_call_id: tc.id,
            });
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
