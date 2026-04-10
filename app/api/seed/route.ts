export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const SEED_PROPERTIES = [
  {
    name: "Koramangala Heights",
    location: "Koramangala",
    area_type: "Super built-up Area",
    total_sqft: 1850,
    bhk: 3,
    bathrooms: 3,
    balconies: 2,
    purchase_price_lakhs: 145,
    purchase_date: "2019-03-15",
    ownership_type: "self-occupied",
    ai_estimated_value_lakhs: 218,
    notes: "Corner unit on 8th floor. Gym and pool in society.",
  },
  {
    name: "Whitefield Residency",
    location: "Whitefield",
    area_type: "Super built-up Area",
    total_sqft: 1240,
    bhk: 2,
    bathrooms: 2,
    balconies: 1,
    purchase_price_lakhs: 72,
    purchase_date: "2021-08-10",
    ownership_type: "rented",
    ai_estimated_value_lakhs: 89,
    notes: "Tenant paying ₹28k/month. Lease renewed until Dec 2025.",
  },
  {
    name: "Sarjapur Skyline",
    location: "Sarjapur Road",
    area_type: "Super built-up Area",
    total_sqft: 1380,
    bhk: 2,
    bathrooms: 2,
    balconies: 2,
    purchase_price_lakhs: 68,
    purchase_date: "2023-01-20",
    ownership_type: "under-construction",
    ai_estimated_value_lakhs: 79,
    notes: "Possession expected Q2 2025. Builder: Prestige Group.",
  },
  {
    name: "Indiranagar Villa",
    location: "Indiranagar",
    area_type: "Super built-up Area",
    total_sqft: 2600,
    bhk: 4,
    bathrooms: 4,
    balconies: 3,
    purchase_price_lakhs: 310,
    purchase_date: "2017-06-05",
    ownership_type: "self-occupied",
    ai_estimated_value_lakhs: 495,
    notes: "Duplex. 3 dedicated parking spots. Prime 100ft road location.",
  },
  {
    name: "Electronic City Studio",
    location: "Electronic City",
    area_type: "Carpet Area",
    total_sqft: 640,
    bhk: 1,
    bathrooms: 1,
    balconies: 1,
    purchase_price_lakhs: 38,
    purchase_date: "2022-11-01",
    ownership_type: "rented",
    ai_estimated_value_lakhs: 42,
    notes: "Near Infosys campus. Rented to IT professional ₹14k/month.",
  },
];

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated. Please sign in first, then revisit this URL." },
      { status: 401 }
    );
  }

  // Check if already seeded
  const { data: existing } = await supabase
    .from("properties")
    .select("id")
    .eq("user_id", user.id);

  if (existing && existing.length > 0) {
    return NextResponse.json({
      message: `Already have ${existing.length} properties. Delete them first if you want to re-seed.`,
      count: existing.length,
    });
  }

  const rows = SEED_PROPERTIES.map((p) => ({ ...p, user_id: user.id }));

  const { data, error } = await supabase
    .from("properties")
    .insert(rows)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: `Seeded ${data.length} properties for ${user.email}`,
    properties: data.map((p: { name: string; location: string; purchase_price_lakhs: number; ai_estimated_value_lakhs: number }) => ({
      name: p.name,
      location: p.location,
      purchase_price_lakhs: p.purchase_price_lakhs,
      ai_estimated_value_lakhs: p.ai_estimated_value_lakhs,
    })),
  });
}
