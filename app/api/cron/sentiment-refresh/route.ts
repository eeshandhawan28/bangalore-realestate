export const runtime = "nodejs";
export const maxDuration = 300; // 5 min — needed for batched LLM calls

import { NextRequest, NextResponse } from "next/server";
import { InferenceClient } from "@huggingface/inference";
import { createClient } from "@supabase/supabase-js";
import localitySentimentFallback from "@/lib/data/locality_sentiment.json";

/*
 * Supabase table (run once in your Supabase SQL editor):
 *
 * create table locality_sentiment (
 *   locality_name   text primary key,
 *   sentiment_score float not null,
 *   trend           text not null check (trend in ('up','stable','down')),
 *   highlights      jsonb not null,
 *   updated_at      timestamptz not null default now()
 * );
 *
 * -- allow server-side writes from service role key only:
 * alter table locality_sentiment enable row level security;
 * create policy "service role full access" on locality_sentiment
 *   using (true) with check (true);
 */

const LOCALITIES = Object.keys(
  localitySentimentFallback as Record<string, unknown>
);

// Process in batches of 5 to stay within LLM context limits
const BATCH_SIZE = 5;

const PROMPT_TEMPLATE = (localities: string[]) => `You are a Bangalore real estate analyst with deep knowledge of the city's infrastructure developments, IT parks, metro expansions, and lifestyle changes.

Analyze the CURRENT real estate development sentiment for each of these Bangalore localities and return a JSON object.

Localities: ${localities.join(", ")}

For each locality, provide:
- sentiment_score: a number between -0.12 and +0.12 reflecting how much recent developments (metro lines, IT park openings, new restaurants/pubs, infrastructure upgrades, environmental concerns) would push property prices up or down vs the locality median
- trend: "up", "stable", or "down"
- highlights: array of exactly 3 short strings describing the most impactful current developments (be specific — name actual metro lines, tech parks, road projects)

Return ONLY a valid JSON object like:
{
  "Locality Name": {
    "sentiment_score": 0.08,
    "trend": "up",
    "highlights": ["Specific development 1", "Specific development 2", "Specific development 3"]
  }
}

No explanation, no markdown, only the JSON object.`;

type SentimentEntry = {
  sentiment_score: number;
  trend: "up" | "stable" | "down";
  highlights: string[];
};

function parseLLMResponse(text: string): Record<string, SentimentEntry> | null {
  // Strip markdown code fences if present
  const cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  // Find the first { and last } to extract just the JSON object
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;

  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    // Validate shape
    for (const [, v] of Object.entries(parsed)) {
      const entry = v as Record<string, unknown>;
      if (
        typeof entry.sentiment_score !== "number" ||
        !["up", "stable", "down"].includes(entry.trend as string) ||
        !Array.isArray(entry.highlights)
      ) {
        return null;
      }
      // Clamp score to safe range
      entry.sentiment_score = Math.max(
        -0.15,
        Math.min(0.15, entry.sentiment_score as number)
      );
    }
    return parsed as Record<string, SentimentEntry>;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  // Verify this is a legitimate Vercel cron call or manual trigger
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const hf = new InferenceClient(process.env.HUGGINGFACE_API_KEY!);

  const results: { locality: string; status: "ok" | "fallback" | "error" }[] =
    [];

  // Process localities in batches
  for (let i = 0; i < LOCALITIES.length; i += BATCH_SIZE) {
    const batch = LOCALITIES.slice(i, i + BATCH_SIZE);

    let parsed: Record<string, SentimentEntry> | null = null;

    try {
      const response = await hf.chatCompletion({
        model: "Qwen/Qwen2.5-7B-Instruct",
        messages: [{ role: "user", content: PROMPT_TEMPLATE(batch) }],
        max_tokens: 1200,
        temperature: 0.3,
      });

      const text =
        response.choices?.[0]?.message?.content ?? "";
      parsed = parseLLMResponse(text);
    } catch {
      // LLM call failed — fall through to per-locality fallback below
    }

    // Upsert each locality in the batch
    for (const locality of batch) {
      const fresh = parsed?.[locality];

      if (fresh) {
        const { error } = await supabase.from("locality_sentiment").upsert(
          {
            locality_name: locality,
            sentiment_score: fresh.sentiment_score,
            trend: fresh.trend,
            highlights: fresh.highlights,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "locality_name" }
        );
        results.push({
          locality,
          status: error ? "error" : "ok",
        });
      } else {
        // Fall back to the hardcoded JSON so the table stays populated
        const fallback = (
          localitySentimentFallback as Record<string, SentimentEntry>
        )[locality];
        if (fallback) {
          await supabase.from("locality_sentiment").upsert(
            {
              locality_name: locality,
              sentiment_score: fallback.sentiment_score,
              trend: fallback.trend,
              highlights: fallback.highlights,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "locality_name" }
          );
        }
        results.push({ locality, status: "fallback" });
      }
    }

    // Brief pause between batches to respect HuggingFace rate limits
    if (i + BATCH_SIZE < LOCALITIES.length) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  const ok = results.filter((r) => r.status === "ok").length;
  const fallback = results.filter((r) => r.status === "fallback").length;
  const errors = results.filter((r) => r.status === "error").length;

  return NextResponse.json({
    refreshed_at: new Date().toISOString(),
    total: LOCALITIES.length,
    llm_updated: ok,
    fallback_used: fallback,
    errors,
  });
}
