"use client";

import { Property } from "@/lib/portfolio";
import { Clock, MapPin, TrendingUp, Home } from "lucide-react";

interface PortfolioMetricsRowProps {
  properties: Property[];
}


function avgHoldingYears(properties: Property[]): number {
  const now = new Date();
  const total = properties.reduce((sum, p) => {
    const ms = now.getTime() - new Date(p.purchase_date).getTime();
    return sum + ms / (1000 * 60 * 60 * 24 * 365.25);
  }, 0);
  return total / properties.length;
}

export function PortfolioMetricsRow({ properties }: PortfolioMetricsRowProps) {
  if (properties.length === 0) return null;

  // Avg holding period
  const avgMonths = Math.round(
    properties.reduce((sum, p) => {
      const now = new Date();
      const start = new Date(p.purchase_date);
      return (
        sum +
        (now.getFullYear() - start.getFullYear()) * 12 +
        (now.getMonth() - start.getMonth())
      );
    }, 0) / properties.length
  );
  const avgYears = Math.floor(avgMonths / 12);
  const avgRemMonths = avgMonths % 12;
  const avgHolding =
    avgYears === 0
      ? `${avgRemMonths}m`
      : avgRemMonths === 0
      ? `${avgYears}y`
      : `${avgYears}y ${avgRemMonths}m`;

  // Monthly rental income estimate (rented properties only)
  const rentalProperties = properties.filter(
    (p) => p.ownership_type === "rented"
  );
  const monthlyRental = rentalProperties.reduce((sum, p) => {
    const val = p.ai_estimated_value_lakhs ?? p.purchase_price_lakhs;
    return sum + Math.round((val * 100000 * 0.003) / 1000) * 1000;
  }, 0);
  const monthlyRentalStr =
    rentalProperties.length === 0
      ? "—"
      : `₹${(monthlyRental / 1000).toFixed(0)}k/mo`;

  // Portfolio CAGR
  const totalInvested = properties.reduce(
    (s, p) => s + p.purchase_price_lakhs,
    0
  );
  const totalCurrent = properties.reduce(
    (s, p) => s + (p.ai_estimated_value_lakhs ?? p.purchase_price_lakhs),
    0
  );
  const holdingYears = avgHoldingYears(properties);
  const cagr =
    holdingYears > 0.5 && totalInvested > 0
      ? ((Math.pow(totalCurrent / totalInvested, 1 / holdingYears) - 1) * 100).toFixed(1)
      : null;

  // Localities covered
  const uniqueLocalities = new Set(properties.map((p) => p.location)).size;

  const metrics = [
    {
      icon: Clock,
      label: "Avg Holding Period",
      value: avgHolding,
      color: "text-[#006494]",
      bg: "bg-[#e0f0f8] dark:bg-[#0a2030]",
    },
    {
      icon: Home,
      label: "Est. Monthly Rental",
      value: monthlyRentalStr,
      color: "text-[#92400e]",
      bg: "bg-[#fef3c7] dark:bg-[#2a1a00]",
      sub: rentalProperties.length > 0 ? `${rentalProperties.length} rented propert${rentalProperties.length > 1 ? "ies" : "y"}` : "No rented properties",
    },
    {
      icon: TrendingUp,
      label: "Portfolio CAGR",
      value: cagr ? `${Number(cagr) >= 0 ? "+" : ""}${cagr}% p.a.` : "—",
      color: "text-primary",
      bg: "bg-primary-highlight",
    },
    {
      icon: MapPin,
      label: "Localities",
      value: uniqueLocalities.toString(),
      color: "text-[#5c6bc0]",
      bg: "bg-[#e8eaf6] dark:bg-[#1a1d3a]",
      sub: `across ${properties.length} propert${properties.length > 1 ? "ies" : "y"}`,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
      {metrics.map((m) => {
        const Icon = m.icon;
        return (
          <div
            key={m.label}
            className="bg-surface border border-border rounded-xl px-4 py-3 flex items-center gap-3"
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${m.bg}`}
            >
              <Icon className={`w-4 h-4 ${m.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{m.label}</p>
              <p className={`font-semibold text-sm ${m.color}`}>{m.value}</p>
              {m.sub && (
                <p className="text-xs text-muted-foreground truncate">{m.sub}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
