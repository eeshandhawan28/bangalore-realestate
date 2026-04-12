"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatLakhs, formatPricePerSqft } from "@/lib/utils/format";
import {
  LineChart, Line, ResponsiveContainer, Tooltip, YAxis,
} from "recharts";
import priceHistory from "@/lib/data/locality_price_history.json";
import rentalYields from "@/lib/data/locality_rental_yields.json";

const HISTORY = priceHistory.localities as Record<string, number[]>;
const PERIODS = priceHistory.periods;
const YIELDS = rentalYields as Record<string, {
  rent_2bhk: number; gross_yield_2bhk_pct: number;
  net_yield_pct: number; appreciation_5y_pct: number;
  appreciation_1y_pct: number; rental_demand: string;
}>;

interface Locality {
  name: string;
  avg_price_per_sqft: number;
  median_1bhk_lakhs?: number;
  median_2bhk_lakhs: number;
  median_3bhk_lakhs: number;
  listing_count: number;
  price_range: { min: number; max: number };
  bhk_split: Record<string, number>;
}

interface LocalityDetailPanelProps {
  locality: Locality | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const BHK_COLORS: Record<string, string> = {
  "1": "bg-[#a8d5b5]",
  "2": "bg-[#2d8a58]",
  "3": "bg-[#1a5c3a]",
  "4+": "bg-[#0d3322]",
};

export function LocalityDetailPanel({
  locality,
  open,
  onOpenChange,
}: LocalityDetailPanelProps) {
  const [sparkRange, setSparkRange] = useState<"1Y" | "3Y" | "5Y">("3Y");
  if (!locality) return null;

  const historyValues = HISTORY[locality.name];
  const yieldData = YIELDS[locality.name];

  // Build sparkline data for selected range
  // 13-point series: 1Y=Q4'24(10)→Q4'25(12), 3Y=Q4'22(6)→Q4'25(12), 5Y=Q4'19(0)→Q4'25(12)
  const rangeStart = sparkRange === "1Y" ? 10 : sparkRange === "3Y" ? 6 : 0;
  const sparkData = historyValues
    ? historyValues.slice(rangeStart).map((v, i) => ({ p: PERIODS[rangeStart + i], v }))
    : null;
  const sparkStart = sparkData?.[0]?.v ?? 0;
  const sparkEnd = sparkData?.[sparkData.length - 1]?.v ?? 0;
  const sparkChangePct = sparkStart > 0 ? ((sparkEnd - sparkStart) / sparkStart) * 100 : null;

  const { min, max } = locality.price_range;
  const avg = locality.avg_price_per_sqft;
  const rangeSpan = max - min;
  const avgPct = rangeSpan > 0 ? ((avg - min) / rangeSpan) * 100 : 50;

  const bhkEntries = Object.entries(locality.bhk_split).filter(
    ([, v]) => v > 0
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:w-[400px] bg-surface border-border overflow-y-auto"
      >
        <SheetHeader className="mb-6">
          <SheetTitle className="font-display text-left">
            {locality.name}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6">
          {/* Price summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-primary-highlight dark:bg-[#1a3528] rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-1">Avg ₹/sqft</p>
              <p className="font-semibold text-primary text-lg">
                {formatPricePerSqft(avg)}
              </p>
            </div>
            <div className="bg-muted rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-1">Listings</p>
              <p className="font-semibold text-foreground text-lg">
                {locality.listing_count}
              </p>
            </div>
          </div>

          {/* Price range bar */}
          <div>
            <p className="text-sm font-semibold text-foreground mb-3">
              Price Range (₹/sqft)
            </p>
            <div className="relative">
              <div className="h-2 rounded-full bg-gradient-to-r from-[#a8d5b5] via-[#2d8a58] to-[#1a5c3a] w-full" />
              {/* Avg dot */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-primary shadow"
                style={{ left: `calc(${avgPct}% - 8px)` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
              <span>{formatPricePerSqft(min)}</span>
              <span className="font-medium text-foreground">
                avg {formatPricePerSqft(avg)}
              </span>
              <span>{formatPricePerSqft(max)}</span>
            </div>
          </div>

          {/* BHK Split */}
          <div>
            <p className="text-sm font-semibold text-foreground mb-3">
              BHK Distribution
            </p>
            <div className="space-y-2">
              {bhkEntries.map(([bhk, pct]) => (
                <div key={bhk} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-8 flex-shrink-0">
                    {bhk} BHK
                  </span>
                  <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${BHK_COLORS[bhk] ?? "bg-primary"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-foreground w-8 text-right">
                    {pct}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* BHK Medians */}
          <div>
            <p className="text-sm font-semibold text-foreground mb-3">
              Median Prices
            </p>
            <div className="grid grid-cols-3 gap-2">
              {locality.median_1bhk_lakhs != null && (
                <div className="bg-muted rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">1 BHK</p>
                  <p className="font-semibold text-sm">
                    {formatLakhs(locality.median_1bhk_lakhs)}
                  </p>
                </div>
              )}
              <div className="bg-muted rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">2 BHK</p>
                <p className="font-semibold text-sm">
                  {formatLakhs(locality.median_2bhk_lakhs)}
                </p>
              </div>
              <div className="bg-muted rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">3 BHK</p>
                <p className="font-semibold text-sm">
                  {formatLakhs(locality.median_3bhk_lakhs)}
                </p>
              </div>
            </div>
          </div>

          {/* Appreciation sparkline */}
          {sparkData && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-foreground">Price Trend (₹/sqft)</p>
                <div className="flex border border-border rounded-md overflow-hidden text-xs">
                  {(["1Y", "3Y", "5Y"] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setSparkRange(r)}
                      className={`px-2.5 py-1 transition-colors ${
                        sparkRange === r
                          ? "bg-primary text-white"
                          : "bg-surface text-muted-foreground"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              {sparkChangePct !== null && (
                <p className="text-xs text-muted-foreground mb-2">
                  {sparkRange} change:{" "}
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    +{sparkChangePct.toFixed(1)}%
                  </span>
                  <span className="ml-2 text-foreground font-medium">
                    ₹{sparkStart.toLocaleString("en-IN")} → ₹{sparkEnd.toLocaleString("en-IN")}
                  </span>
                </p>
              )}
              <ResponsiveContainer width="100%" height={80}>
                <LineChart data={sparkData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <YAxis domain={["auto", "auto"]} hide />
                  <Tooltip
                    formatter={(v) => [`₹${Number(v).toLocaleString("en-IN")}/sqft`, "Price"]}
                    labelFormatter={(l) => l}
                    contentStyle={{
                      fontSize: 11,
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "var(--surface)",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="v"
                    stroke="#2d8a58"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Rental yield card */}
          {yieldData && (
            <div className="bg-muted rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-foreground">Rental Yield (2BHK)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Avg Monthly Rent</p>
                  <p className="font-semibold text-foreground">
                    ₹{yieldData.rent_2bhk.toLocaleString("en-IN")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Gross Yield</p>
                  <p className="font-semibold text-primary">{yieldData.gross_yield_2bhk_pct.toFixed(2)}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Net Yield</p>
                  <p className="font-semibold text-foreground">{yieldData.net_yield_pct.toFixed(2)}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Rental Demand</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    yieldData.rental_demand === "High"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                      : yieldData.rental_demand === "Medium"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-500"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {yieldData.rental_demand}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
