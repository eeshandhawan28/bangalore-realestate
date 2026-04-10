export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { InferenceClient } from "@huggingface/inference";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createAgentTools } from "@/lib/agent/tools";

const MODEL = "Qwen/Qwen2.5-7B-Instruct";

const SYSTEM_PROMPT = `You are PropIQ Copilot, an AI assistant specialized in Bangalore real estate.

You have access to tools to fetch the user's portfolio, run valuations, query market stats, find localities by budget, create listings, and check RERA registrations.

ALWAYS call the appropriate tool before answering questions that require data.
Format all prices in Indian notation: ₹XL for lakhs (e.g. ₹85L), ₹X Cr for crores (e.g. ₹1.2 Cr).
Keep answers concise and actionable. Market data is from Q4 2024.`;

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
];

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
        const messages: ChatMessage[] = [
          { role: "system", content: SYSTEM_PROMPT },
          ...incomingMessages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        ];

        // ReAct loop — max 5 tool-call rounds
        for (let round = 0; round < 5; round++) {
          console.log(`[chat] round ${round}, calling model`);

          const response = await client.chatCompletion({
            model: MODEL,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            messages: messages as any,
            tools: TOOL_SPECS,
            tool_choice: "auto",
            max_tokens: 1024,
          });

          const choice = response.choices[0];
          const assistantMsg = choice.message;

          // No tool calls → stream the final answer
          if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
            const text = assistantMsg.content ?? "";
            // Stream token by token (word chunks for UX)
            const words = text.split(" ");
            for (let i = 0; i < words.length; i++) {
              send({ type: "token", content: (i === 0 ? "" : " ") + words[i] });
            }
            break;
          }

          // Has tool calls → execute each one
          messages.push({
            role: "assistant",
            content: assistantMsg.content ?? "",
            tool_calls: assistantMsg.tool_calls.map((tc) => ({
              id: tc.id,
              type: "function" as const,
              function: { name: tc.function.name, arguments: tc.function.arguments },
            })),
          });

          for (const tc of assistantMsg.tool_calls) {
            const toolName = tc.function.name;
            send({ type: "tool_start", tool: toolName });

            let args: Record<string, unknown> = {};
            try {
              args = JSON.parse(tc.function.arguments);
            } catch {
              args = {};
            }

            const executor = toolMap[toolName];
            const result = executor
              ? await executor(args)
              : `Unknown tool: ${toolName}`;

            send({ type: "tool_end", tool: toolName });

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
