"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { calculateValuation } from "@/lib/valuation";

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
    ownership_type: "self-occupied" as const,
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
    ownership_type: "rented" as const,
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
    ownership_type: "under-construction" as const,
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
    ownership_type: "self-occupied" as const,
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
    ownership_type: "rented" as const,
    notes: "Near Infosys campus. Rented to IT professional ₹14k/month.",
  },
];

export default function SeedPage() {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<{ name: string; value: number }[]>([]);

  const runSeed = async () => {
    setStatus("running");
    setMessage("Checking authentication...");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setStatus("error");
      setMessage("Not signed in. Please go to /login first.");
      return;
    }

    setMessage("Checking for existing properties...");
    const { data: existing } = await supabase
      .from("properties")
      .select("id")
      .eq("user_id", user.id);

    if (existing && existing.length > 0) {
      setStatus("done");
      setMessage(`Already have ${existing.length} properties — no seed needed. Go to /portfolio to see them.`);
      return;
    }

    setMessage("Inserting properties...");

    const rows = SEED_PROPERTIES.map((p) => {
      const valuation = calculateValuation({
        location: p.location,
        area_type: p.area_type,
        total_sqft: p.total_sqft,
        bhk: p.bhk,
        bathrooms: p.bathrooms,
        balconies: p.balconies,
      });
      return { ...p, user_id: user.id, ai_estimated_value_lakhs: valuation.predicted_price_lakhs };
    });

    const { data, error } = await supabase.from("properties").insert(rows).select();

    if (error) {
      setStatus("error");
      setMessage(`DB error: ${error.message}`);
      return;
    }

    setStatus("done");
    setMessage(`Done! Inserted ${data.length} properties for ${user.email}`);
    setResults(data.map((p: { name: string; ai_estimated_value_lakhs: number }) => ({
      name: p.name,
      value: p.ai_estimated_value_lakhs,
    })));
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16 space-y-6">
      <h1 className="font-display text-2xl font-semibold text-foreground">Seed Portfolio Data</h1>
      <p className="text-sm text-muted-foreground">
        Inserts 5 realistic Bangalore properties into your account. Safe to run once — will skip if data already exists.
      </p>

      <Button
        onClick={runSeed}
        disabled={status === "running" || status === "done"}
        className="bg-primary hover:bg-primary/90 text-white w-full"
      >
        {status === "running" ? "Seeding..." : status === "done" ? "Done ✓" : "Seed My Portfolio"}
      </Button>

      {message && (
        <p className={`text-sm px-3 py-2 rounded-lg ${
          status === "error"
            ? "bg-destructive/10 text-destructive"
            : status === "done"
            ? "bg-green-500/10 text-green-600"
            : "bg-muted text-muted-foreground"
        }`}>
          {message}
        </p>
      )}

      {results.length > 0 && (
        <ul className="space-y-1 text-sm">
          {results.map((r) => (
            <li key={r.name} className="flex justify-between text-foreground">
              <span>{r.name}</span>
              <span className="text-muted-foreground">₹{r.value}L</span>
            </li>
          ))}
        </ul>
      )}

      {status === "done" && results.length > 0 && (
        <a href="/portfolio" className="block text-center text-sm text-primary hover:underline">
          Go to Portfolio →
        </a>
      )}
    </div>
  );
}
