"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

const PAGE_SIZE = 12; // 4 rows × 3 cols desktop
import { formatLakhs, formatPricePerSqft } from "@/lib/utils/format";

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

interface LocalityCardGridProps {
  localities: Locality[];
  onSelectLocality: (locality: Locality) => void;
  selectedLocality: string | null;
  budgetFilter?: { budget: number; bhk: 1 | 2 | 3 } | null;
}

export function LocalityCardGrid({
  localities,
  onSelectLocality,
  selectedLocality,
  budgetFilter,
}: LocalityCardGridProps) {
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const isWithinBudget = (l: Locality) => {
    if (!budgetFilter) return null;
    const median =
      budgetFilter.bhk === 1
        ? l.median_1bhk_lakhs ?? Infinity
        : budgetFilter.bhk === 2
        ? l.median_2bhk_lakhs
        : l.median_3bhk_lakhs;
    return median <= budgetFilter.budget;
  };

  const sorted = useMemo(() => {
    setVisibleCount(PAGE_SIZE);
    return localities
      .filter((l) => l.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        if (budgetFilter) {
          const aIn = isWithinBudget(a);
          const bIn = isWithinBudget(b);
          if (aIn && !bIn) return -1;
          if (!aIn && bIn) return 1;
        }
        return b.avg_price_per_sqft - a.avg_price_per_sqft;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localities, search, budgetFilter]);

  const getPriceLevel = (psf: number) => {
    if (psf >= 10000) return { label: "Premium", color: "text-[#92400e] dark:text-[#fbbf24]", bg: "bg-[#fef3c7] dark:bg-[#2a1a00]" };
    if (psf >= 7000) return { label: "High", color: "text-[#437a22] dark:text-[#6fbc3a]", bg: "bg-[#d0e8da] dark:bg-[#1a3528]" };
    if (psf >= 5000) return { label: "Mid", color: "text-[#006494] dark:text-[#4da9d8]", bg: "bg-[#dceef8] dark:bg-[#0a2030]" };
    return { label: "Budget", color: "text-muted-foreground", bg: "bg-muted" };
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search locality..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {budgetFilter && (
        <p className="text-xs text-muted-foreground">
          {sorted.filter((l) => isWithinBudget(l)).length} of {sorted.length} localities within budget — sorted to top
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {sorted.slice(0, visibleCount).map((locality) => {
          const withinBudget = isWithinBudget(locality);
          const isSelected = selectedLocality === locality.name;
          const level = getPriceLevel(locality.avg_price_per_sqft);
          const { min, max } = locality.price_range;
          const avg = locality.avg_price_per_sqft;
          const span = max - min;
          const avgPct = span > 0 ? ((avg - min) / span) * 100 : 50;

          return (
            <button
              key={`${locality.name}-${locality.avg_price_per_sqft}`}
              onClick={() => onSelectLocality(locality)}
              className={`text-left rounded-xl border p-4 transition-all ${
                isSelected
                  ? "border-primary bg-primary-highlight shadow-md"
                  : withinBudget === true
                  ? "border-primary/30 bg-[#d0e8da]/30 dark:bg-[#1a3528]/30 hover:border-primary/50"
                  : withinBudget === false
                  ? "border-border bg-surface opacity-50 hover:opacity-70"
                  : "border-border bg-surface hover:border-primary/30 hover:shadow-sm"
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm leading-tight truncate">
                    {locality.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {locality.listing_count} listings
                  </p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${level.bg} ${level.color}`}>
                  {level.label}
                </span>
              </div>

              {/* Avg price */}
              <p className="font-display text-lg font-bold text-primary mb-3">
                {formatPricePerSqft(locality.avg_price_per_sqft)}
              </p>

              {/* BHK medians */}
              <div className="flex gap-2 mb-3">
                {locality.median_1bhk_lakhs != null && (
                  <div className="flex-1 bg-muted rounded-lg px-2 py-1.5 text-center">
                    <p className="text-[10px] text-muted-foreground">1 BHK</p>
                    <p className="text-xs font-semibold text-foreground">{formatLakhs(locality.median_1bhk_lakhs)}</p>
                  </div>
                )}
                <div className="flex-1 bg-muted rounded-lg px-2 py-1.5 text-center">
                  <p className="text-[10px] text-muted-foreground">2 BHK</p>
                  <p className="text-xs font-semibold text-foreground">{formatLakhs(locality.median_2bhk_lakhs)}</p>
                </div>
                <div className="flex-1 bg-muted rounded-lg px-2 py-1.5 text-center">
                  <p className="text-[10px] text-muted-foreground">3 BHK</p>
                  <p className="text-xs font-semibold text-foreground">{formatLakhs(locality.median_3bhk_lakhs)}</p>
                </div>
              </div>

              {/* Price range bar */}
              <div className="relative">
                <div className="h-1.5 rounded-full bg-gradient-to-r from-[#a8d5b5] via-[#2d8a58] to-[#1a5c3a] w-full" />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-primary shadow-sm"
                  style={{ left: `calc(${avgPct}% - 6px)` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>{formatPricePerSqft(min)}</span>
                <span>{formatPricePerSqft(max)}</span>
              </div>
            </button>
          );
        })}
      </div>

      {sorted.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">
          No localities matching &ldquo;{search}&rdquo;
        </p>
      )}

      {visibleCount < sorted.length && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Showing {Math.min(visibleCount, sorted.length)} of {sorted.length} localities
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          >
            Show {Math.min(PAGE_SIZE, sorted.length - visibleCount)} more
          </Button>
        </div>
      )}
    </div>
  );
}
