export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import localitySentimentFallback from "@/lib/data/locality_sentiment.json";

type SentimentRow = {
  locality_name: string;
  sentiment_score: number;
  trend: "up" | "stable" | "down";
  highlights: string[];
  updated_at: string;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { locality: string } }
) {
  const locality = decodeURIComponent(params.locality);

  // Try Supabase first (live data)
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase
      .from("locality_sentiment")
      .select("*")
      .eq("locality_name", locality)
      .single();

    if (!error && data) {
      const row = data as SentimentRow;
      return NextResponse.json({
        source: "live",
        locality_name: row.locality_name,
        sentiment_score: row.sentiment_score,
        trend: row.trend,
        highlights: row.highlights,
        updated_at: row.updated_at,
      });
    }
  } catch {
    // Fall through to static fallback
  }

  // Fall back to the bundled JSON (always available, no network call)
  const fallback = (
    localitySentimentFallback as Record<
      string,
      { sentiment_score: number; trend: string; highlights: string[] }
    >
  )[locality];

  if (fallback) {
    return NextResponse.json({
      source: "static",
      locality_name: locality,
      sentiment_score: fallback.sentiment_score,
      trend: fallback.trend,
      highlights: fallback.highlights,
      updated_at: null,
    });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
