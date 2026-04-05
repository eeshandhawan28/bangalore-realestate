"use client";

import { supabase } from "./supabase";

export interface Property {
  id: string;
  user_id?: string;
  name: string;
  location: string;
  area_type: string;
  total_sqft: number;
  bhk: number;
  bathrooms: number;
  balconies: number;
  purchase_price_lakhs: number;
  purchase_date: string;
  ownership_type: "self-occupied" | "rented" | "under-construction";
  notes?: string;
  ai_estimated_value_lakhs?: number;
  created_at?: string;
}

export interface PortfolioSummary {
  totalValue: number;
  totalInvested: number;
  totalReturn: number;
  returnPercent: number;
  count: number;
}

export async function getProperties(): Promise<Property[]> {
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching properties:", error);
    return [];
  }
  return (data ?? []) as Property[];
}

export async function addProperty(
  data: Omit<Property, "id" | "created_at" | "user_id">
): Promise<Property | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: inserted, error } = await supabase
    .from("properties")
    .insert({ ...data, user_id: user.id })
    .select()
    .single();

  if (error) {
    console.error("Error adding property:", error);
    return null;
  }
  return inserted as Property;
}

export async function updateProperty(
  id: string,
  updates: Partial<Property>
): Promise<Property | null> {
  const { data, error } = await supabase
    .from("properties")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating property:", error);
    return null;
  }
  return data as Property;
}

export async function deleteProperty(id: string): Promise<void> {
  const { error } = await supabase.from("properties").delete().eq("id", id);
  if (error) console.error("Error deleting property:", error);
}

export function getPortfolioSummary(properties: Property[]): PortfolioSummary {
  const totalInvested = properties.reduce(
    (sum, p) => sum + p.purchase_price_lakhs,
    0
  );
  const totalValue = properties.reduce(
    (sum, p) =>
      sum + (p.ai_estimated_value_lakhs ?? p.purchase_price_lakhs),
    0
  );
  const totalReturn = totalValue - totalInvested;
  const returnPercent =
    totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;

  return {
    totalValue,
    totalInvested,
    totalReturn,
    returnPercent,
    count: properties.length,
  };
}
