"use client";

export interface Property {
  id: string;
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
  created_at: string;
}

export interface PortfolioSummary {
  totalValue: number;
  totalInvested: number;
  totalReturn: number;
  returnPercent: number;
  count: number;
}

const STORAGE_KEY = "propiq_portfolio";

export function getProperties(): Property[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveProperties(properties: Property[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(properties));
}

export function addProperty(
  data: Omit<Property, "id" | "created_at">
): Property {
  const property: Property = {
    ...data,
    id: `prop-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    created_at: new Date().toISOString(),
  };
  const properties = getProperties();
  properties.push(property);
  saveProperties(properties);
  return property;
}

export function updateProperty(
  id: string,
  updates: Partial<Property>
): Property | null {
  const properties = getProperties();
  const idx = properties.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  properties[idx] = { ...properties[idx], ...updates };
  saveProperties(properties);
  return properties[idx];
}

export function deleteProperty(id: string): void {
  const properties = getProperties().filter((p) => p.id !== id);
  saveProperties(properties);
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
