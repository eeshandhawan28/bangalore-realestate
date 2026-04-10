"use client";

import { useState } from "react";
import rentalData from "@/lib/data/locality_rental_yields.json";
import { TrendingUp, ArrowUpDown } from "lucide-react";

type YieldEntry = {
  locality: string;
  rent_2bhk: number;
  rent_3bhk: number;
  gross_yield_2bhk_pct: number;
  gross_yield_3bhk_pct: number;
  net_yield_pct: number;
  appreciation_5y_pct: number;
  appreciation_1y_pct: number;
  rental_demand: "High" | "Medium" | "Low";
};

type SortKey = "gross_yield_2bhk_pct" | "net_yield_pct" | "appreciation_5y_pct" | "rent_2bhk";

const RAW = rentalData as Record<string, Omit<YieldEntry, "locality">>;

const ROWS: YieldEntry[] = Object.entries(RAW).map(([locality, data]) => ({
  locality,
  ...data,
}));

const DEMAND_STYLE: Record<string, string> = {
  High:   "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  Medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-500",
  Low:    "bg-muted text-muted-foreground",
};

function YieldBar({ value, max }: { value: number; max: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full"
          style={{ width: `${(value / max) * 100}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-foreground w-10 text-right">
        {value.toFixed(2)}%
      </span>
    </div>
  );
}

export function RentalYieldTable() {
  const [sortKey, setSortKey] = useState<SortKey>("gross_yield_2bhk_pct");
  const [budget, setBudget] = useState<string>("");

  const sorted = [...ROWS].sort((a, b) => b[sortKey] - a[sortKey]);
  const maxYield = Math.max(...ROWS.map((r) => r.gross_yield_2bhk_pct));
  const max5yAppreciation = Math.max(...ROWS.map((r) => r.appreciation_5y_pct));

  // Budget-based recommendations: find localities where 2BHK median is within budget
  // We use gross_yield as a proxy for "best investment" within budget
  const budgetNum = parseFloat(budget);
  const budgetRecs =
    !isNaN(budgetNum) && budgetNum > 0
      ? ROWS
          .filter((r) => {
            // Estimate median 2BHK price from rent using the yield itself
            const implied2bhkPrice = (r.rent_2bhk * 12) / (r.gross_yield_2bhk_pct / 100);
            return implied2bhkPrice / 100000 <= budgetNum;
          })
          .sort((a, b) => b.gross_yield_2bhk_pct - a.gross_yield_2bhk_pct)
          .slice(0, 5)
      : null;

  function SortHeader({ label, k }: { label: string; k: SortKey }) {
    return (
      <button
        onClick={() => setSortKey(k)}
        className={`flex items-center gap-1 text-xs font-medium ${
          sortKey === k ? "text-primary" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {label}
        <ArrowUpDown className="w-3 h-3" />
      </button>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display font-semibold text-foreground">
            Rental Yield by Locality
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gross &amp; net yield estimates based on Q4 2024 transaction data
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Your budget (₹L):</span>
          <input
            type="number"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="e.g. 90"
            className="w-24 h-8 px-2.5 rounded-lg border border-border bg-surface text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Budget recommendations */}
      {budgetRecs && budgetRecs.length > 0 && (
        <div className="bg-primary-highlight dark:bg-[#1a3528] border border-primary/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">
              Top picks within ₹{budgetNum}L budget
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {budgetRecs.map((r) => (
              <div key={r.locality} className="bg-surface border border-border rounded-lg p-2.5 text-center">
                <p className="text-xs font-semibold text-foreground truncate">{r.locality}</p>
                <p className="text-sm font-bold text-primary mt-0.5">{r.gross_yield_2bhk_pct.toFixed(2)}%</p>
                <p className="text-xs text-muted-foreground">gross yield</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sort controls */}
      <div className="flex gap-4 flex-wrap text-xs">
        <span className="text-muted-foreground self-center">Sort by:</span>
        <SortHeader label="Gross Yield" k="gross_yield_2bhk_pct" />
        <SortHeader label="Net Yield" k="net_yield_pct" />
        <SortHeader label="5Y Appreciation" k="appreciation_5y_pct" />
        <SortHeader label="Monthly Rent" k="rent_2bhk" />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Locality</th>
              <th className="text-left py-2 pr-4 text-muted-foreground font-medium">2BHK Rent/mo</th>
              <th className="text-left py-2 pr-6 text-muted-foreground font-medium min-w-[120px]">Gross Yield (2BHK)</th>
              <th className="text-left py-2 pr-6 text-muted-foreground font-medium min-w-[100px]">Net Yield</th>
              <th className="text-left py-2 pr-4 text-muted-foreground font-medium">5Y Price ↑</th>
              <th className="text-left py-2 text-muted-foreground font-medium">Demand</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={row.locality}
                className="border-b border-border/50 hover:bg-muted/30 transition-colors"
              >
                <td className="py-3 pr-4 font-semibold text-foreground whitespace-nowrap">
                  {row.locality}
                </td>
                <td className="py-3 pr-4 text-foreground">
                  ₹{row.rent_2bhk.toLocaleString("en-IN")}
                </td>
                <td className="py-3 pr-6 min-w-[120px]">
                  <YieldBar value={row.gross_yield_2bhk_pct} max={maxYield} />
                </td>
                <td className="py-3 pr-6 min-w-[100px]">
                  <YieldBar value={row.net_yield_pct} max={maxYield} />
                </td>
                <td className="py-3 pr-4">
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    +{row.appreciation_5y_pct.toFixed(1)}%
                  </span>
                  <span className="text-muted-foreground ml-1 text-xs">
                    (+{row.appreciation_1y_pct.toFixed(1)}% 1Y)
                  </span>
                </td>
                <td className="py-3">
                  <span className={`px-2 py-0.5 rounded-full font-medium text-xs ${DEMAND_STYLE[row.rental_demand]}`}>
                    {row.rental_demand}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Net yield = gross yield × 0.75 (accounts for ~25% vacancy, maintenance &amp; property tax).
        Appreciation data: Q4 2019 → Q4 2024.
      </p>
    </div>
  );
}
