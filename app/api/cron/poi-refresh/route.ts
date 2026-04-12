export const runtime = "nodejs";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import coordinates from "@/lib/data/locality_coordinates.json";
import poiFallback from "@/lib/data/locality_poi.json";

/*
 * Supabase table (run once in your Supabase SQL editor):
 *
 * create table locality_poi (
 *   locality_name    text primary key,
 *   schools          int not null default 0,
 *   hospitals        int not null default 0,
 *   malls            int not null default 0,
 *   parks            int not null default 0,
 *   offices          int not null default 0,
 *   metro_distance_m int not null default 9999,
 *   special_infra    jsonb not null default '[]',
 *   updated_at       timestamptz not null default now()
 * );
 *
 * alter table locality_poi enable row level security;
 * create policy "public read" on locality_poi for select using (true);
 * create policy "service role write" on locality_poi for all using (true) with check (true);
 */

// Geoapify category groups
const AMENITY_CATEGORIES = [
  "education.school",
  "healthcare.hospital",
  "commercial.shopping_mall",
  "leisure.park",
  "office",
].join(",");

const TRANSIT_CATEGORY = "public_transport.train.station";
const RADIUS_M = 3000;

type Coords = Record<string, { lat: number; lng: number }>;
type POIEntry = {
  schools: number;
  hospitals: number;
  malls: number;
  parks: number;
  offices: number;
  metro_distance_m: number;
  special_infra: string[];
};

type GeoapifyFeature = {
  properties: {
    categories: string[];
    distance?: number;
  };
};

async function fetchPOICounts(
  lat: number,
  lng: number,
  apiKey: string
): Promise<Omit<POIEntry, "special_infra" | "metro_distance_m">> {
  const url = new URL("https://api.geoapify.com/v2/places");
  url.searchParams.set("categories", AMENITY_CATEGORIES);
  url.searchParams.set("filter", `circle:${lng},${lat},${RADIUS_M}`);
  url.searchParams.set("limit", "100");
  url.searchParams.set("apiKey", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Geoapify amenities error: ${res.status}`);
  const json = await res.json() as { features: GeoapifyFeature[] };

  const features: GeoapifyFeature[] = json.features ?? [];
  const counts = { schools: 0, hospitals: 0, malls: 0, parks: 0, offices: 0 };

  for (const f of features) {
    const cats = f.properties.categories ?? [];
    if (cats.some((c) => c.startsWith("education.school"))) counts.schools++;
    else if (cats.some((c) => c.startsWith("healthcare.hospital"))) counts.hospitals++;
    else if (cats.some((c) => c.startsWith("commercial.shopping_mall"))) counts.malls++;
    else if (cats.some((c) => c.startsWith("leisure.park"))) counts.parks++;
    else if (cats.some((c) => c.startsWith("office"))) counts.offices++;
  }

  return counts;
}

async function fetchNearestMetro(
  lat: number,
  lng: number,
  apiKey: string
): Promise<number> {
  const url = new URL("https://api.geoapify.com/v2/places");
  url.searchParams.set("categories", TRANSIT_CATEGORY);
  url.searchParams.set("filter", `circle:${lng},${lat},10000`); // 10km search
  url.searchParams.set("limit", "1");
  url.searchParams.set("apiKey", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) return 9999;
  const json = await res.json() as { features: GeoapifyFeature[] };

  const features: GeoapifyFeature[] = json.features ?? [];
  if (features.length === 0) return 9999;
  return Math.round(features[0].properties.distance ?? 9999);
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GEOAPIFY_API_KEY;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const COORDS = coordinates as Coords;
  const FALLBACK = poiFallback as unknown as Record<string, POIEntry & { _note?: string }>;
  const localities = Object.keys(COORDS);

  const results: { locality: string; status: "ok" | "fallback" | "error" }[] = [];

  for (const locality of localities) {
    const coord = COORDS[locality];
    // Preserve special_infra from the seeded JSON — Geoapify doesn't classify these
    const existingSpecial = FALLBACK[locality]?.special_infra ?? [];

    let entry: POIEntry | null = null;

    if (apiKey && coord) {
      try {
        const [counts, metroDist] = await Promise.all([
          fetchPOICounts(coord.lat, coord.lng, apiKey),
          fetchNearestMetro(coord.lat, coord.lng, apiKey),
        ]);
        entry = { ...counts, metro_distance_m: metroDist, special_infra: existingSpecial };
      } catch (e) {
        console.error(`[poi-refresh] ${locality} fetch failed:`, e);
      }
    }

    // Fall back to seeded JSON if no API key or fetch failed
    if (!entry) {
      const fb = FALLBACK[locality];
      entry = fb
        ? { schools: fb.schools, hospitals: fb.hospitals, malls: fb.malls, parks: fb.parks, offices: fb.offices, metro_distance_m: fb.metro_distance_m, special_infra: existingSpecial }
        : { schools: 0, hospitals: 0, malls: 0, parks: 0, offices: 0, metro_distance_m: 9999, special_infra: [] };
    }

    const { error } = await supabase.from("locality_poi").upsert(
      {
        locality_name: locality,
        schools: entry.schools,
        hospitals: entry.hospitals,
        malls: entry.malls,
        parks: entry.parks,
        offices: entry.offices,
        metro_distance_m: entry.metro_distance_m,
        special_infra: entry.special_infra,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "locality_name" }
    );

    results.push({ locality, status: error ? "error" : entry ? "ok" : "fallback" });

    // Respect Geoapify rate limits — 5 req/s on free tier
    await new Promise((r) => setTimeout(r, 250));
  }

  const ok = results.filter((r) => r.status === "ok").length;
  const fallback = results.filter((r) => r.status === "fallback").length;
  const errors = results.filter((r) => r.status === "error").length;

  return NextResponse.json({
    refreshed_at: new Date().toISOString(),
    total: localities.length,
    geoapify_updated: ok,
    fallback_used: fallback,
    errors,
    api_key_present: !!apiKey,
  });
}
