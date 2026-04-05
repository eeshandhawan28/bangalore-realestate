"use client";

import { useState } from "react";
import marketStats from "@/lib/data/market_stats.json";
import { LocalityRankingTable } from "@/components/market/LocalityRankingTable";
import { PriceDistributionChart } from "@/components/market/PriceDistributionChart";
import { formatLakhs, formatPricePerSqft, formatNumber } from "@/lib/utils/format";
import { TrendingUp, Building2, BarChart2, MapPin } from "lucide-react";

const topLocality = [...marketStats.localities].sort(
  (a, b) => b.avg_price_per_sqft - a.avg_price_per_sqft
)[0];

export default function MarketPage() {
  const [selectedLocality, setSelectedLocality] = useState<string | null>(null);

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
                <p className="text-xs text-muted-foreground mt-0.5">
                  {card.sub}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
        <PriceDistributionChart
          localities={marketStats.localities}
          selectedLocality={selectedLocality}
        />
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
        <h2 className="font-display font-semibold text-foreground mb-4">
          Locality Rankings
        </h2>
        <LocalityRankingTable
          localities={marketStats.localities}
          onSelectLocality={(l) =>
            setSelectedLocality(
              l.name === selectedLocality ? null : l.name
            )
          }
          selectedLocality={selectedLocality}
        />
      </div>
    </div>
  );
}
