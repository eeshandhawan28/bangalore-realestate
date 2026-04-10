"use client";

import { useState } from "react";
import marketStats from "@/lib/data/market_stats.json";
import { LocalityCardGrid } from "@/components/market/LocalityCardGrid";
import { PriceDistributionChart } from "@/components/market/PriceDistributionChart";
import { BudgetExplorer } from "@/components/market/BudgetExplorer";
import { LocalityDetailPanel } from "@/components/market/LocalityDetailPanel";
import { AppreciationTrendsChart } from "@/components/market/AppreciationTrendsChart";
import { RentalYieldTable } from "@/components/market/RentalYieldTable";
import { formatLakhs, formatPricePerSqft, formatNumber } from "@/lib/utils/format";
import { TrendingUp, Building2, BarChart2, MapPin } from "lucide-react";

// Deduplicate localities by name (keep first occurrence)
const uniqueLocalities = marketStats.localities.filter(
  (l, i, arr) => arr.findIndex((x) => x.name === l.name) === i
);

const topLocality = [...uniqueLocalities].sort(
  (a, b) => b.avg_price_per_sqft - a.avg_price_per_sqft
)[0];

type BudgetFilter = { budget: number; bhk: 1 | 2 | 3 } | null;
type LocalityData = (typeof marketStats.localities)[number];

export default function MarketPage() {
  const [selectedLocality, setSelectedLocality] = useState<string | null>(null);
  const [detailLocality, setDetailLocality] = useState<LocalityData | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [budgetFilter, setBudgetFilter] = useState<BudgetFilter>(null);

  const handleSelectLocality = (l: LocalityData) => {
    setSelectedLocality(l.name === selectedLocality ? null : l.name);
    setDetailLocality(l as LocalityData);
    setDetailOpen(true);
  };

  const handleBudgetLocalityClick = (name: string) => {
    const l = uniqueLocalities.find((x) => x.name === name);
    if (l) handleSelectLocality(l as LocalityData);
  };

  const summaryCards = [
    {
      label: "City Avg ₹/sqft",
      value: formatPricePerSqft(marketStats.city_summary.avg_price_per_sqft),
      icon: TrendingUp,
    },
    {
      label: "Median 2BHK Price",
      value: formatLakhs(marketStats.city_summary.median_2bhk_lakhs),
      icon: Building2,
    },
    {
      label: "Transactions in Dataset",
      value: formatNumber(marketStats.city_summary.total_transactions),
      icon: BarChart2,
    },
    {
      label: "Top Locality",
      value: topLocality.name,
      sub: formatPricePerSqft(topLocality.avg_price_per_sqft),
      icon: MapPin,
    },
  ];

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">
          Market Analytics
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bangalore property market data from 13,320+ transactions
        </p>
      </div>

      {/* City summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-surface border border-border rounded-xl p-4 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-primary-highlight flex items-center justify-center">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </div>
              <p className="font-display font-semibold text-foreground">
                {card.value}
              </p>
              {card.sub && (
                <p className="text-xs text-muted-foreground mt-0.5">{card.sub}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Budget Explorer */}
      <BudgetExplorer
        localities={uniqueLocalities}
        onFilterChange={setBudgetFilter}
        onLocalityClick={handleBudgetLocalityClick}
      />

      {/* Chart */}
      <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
        <PriceDistributionChart
          localities={uniqueLocalities}
          selectedLocality={selectedLocality}
        />
      </div>

      {/* Locality card grid */}
      <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
        <h2 className="font-display font-semibold text-foreground mb-4">
          Browse Localities
        </h2>
        <LocalityCardGrid
          localities={uniqueLocalities}
          onSelectLocality={(l) => handleSelectLocality(l as LocalityData)}
          selectedLocality={selectedLocality}
          budgetFilter={budgetFilter}
        />
      </div>

      {/* Appreciation Trends */}
      <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
        <AppreciationTrendsChart />
      </div>

      {/* Rental Yields */}
      <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
        <RentalYieldTable />
      </div>

      <LocalityDetailPanel
        locality={detailLocality}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
