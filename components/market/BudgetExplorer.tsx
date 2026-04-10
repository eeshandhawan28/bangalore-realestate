"use client";

import { useState, useMemo } from "react";
import { formatLakhs, formatPricePerSqft } from "@/lib/utils/format";
import { MapPin } from "lucide-react";

interface Locality {
  name: string;
  avg_price_per_sqft: number;
  median_1bhk_lakhs?: number;
  median_2bhk_lakhs: number;
  median_3bhk_lakhs: number;
  listing_count: number;
}

interface BudgetExplorerProps {
  localities: Locality[];
  onFilterChange: (filter: { budget: number; bhk: 1 | 2 | 3 } | null) => void;
  onLocalityClick: (name: string) => void;
}

const MIN = 20;
const MAX = 300;

export function BudgetExplorer({ localities, onFilterChange, onLocalityClick }: BudgetExplorerProps) {
  const [budget, setBudget] = useState<number>(100);
  const [bhk, setBhk] = useState<1 | 2 | 3>(2);
  const [active, setActive] = useState(false);

  const handleSlider = (val: number) => {
    setBudget(val);
    if (active) onFilterChange({ budget: val, bhk });
  };

  const handleBhk = (b: 1 | 2 | 3) => {
    setBhk(b);
    if (active) onFilterChange({ budget, bhk: b });
  };

  const toggle = () => {
    const next = !active;
    setActive(next);
    onFilterChange(next ? { budget, bhk } : null);
  };

  const matches = useMemo(() => {
    if (!active) return [];
    return localities
      .filter((l) => {
        const median =
          bhk === 1
            ? l.median_1bhk_lakhs ?? Infinity
            : bhk === 2
            ? l.median_2bhk_lakhs
            : l.median_3bhk_lakhs;
        return median <= budget;
      })
      .sort((a, b) => {
        const ma =
          bhk === 1 ? a.median_1bhk_lakhs ?? 0 : bhk === 2 ? a.median_2bhk_lakhs : a.median_3bhk_lakhs;
        const mb =
          bhk === 1 ? b.median_1bhk_lakhs ?? 0 : bhk === 2 ? b.median_2bhk_lakhs : b.median_3bhk_lakhs;
        return ma - mb;
      })
      .slice(0, 5);
  }, [active, localities, budget, bhk]);

  return (
    <div className="bg-surface border border-border rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Budget Explorer</p>
          <p className="text-xs text-muted-foreground">Find localities within your budget</p>
        </div>
        <button
          onClick={toggle}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
            active
              ? "bg-primary text-white"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          {active ? "Active" : "Enable"}
        </button>
      </div>

      <div className={`space-y-4 transition-opacity ${active ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
        {/* BHK toggle */}
        <div className="flex gap-2">
          {([1, 2, 3] as const).map((b) => (
            <button
              key={b}
              onClick={() => handleBhk(b)}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                bhk === b
                  ? "bg-primary text-white"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {b} BHK
            </button>
          ))}
        </div>

        {/* Slider */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatLakhs(MIN)}</span>
            <span className="font-semibold text-foreground text-sm">
              Budget: {formatLakhs(budget)}
            </span>
            <span>{formatLakhs(MAX)}</span>
          </div>
          <input
            type="range"
            min={MIN}
            max={MAX}
            step={5}
            value={budget}
            onChange={(e) => handleSlider(Number(e.target.value))}
            className="w-full accent-primary h-1.5 rounded-full cursor-pointer"
          />
        </div>

        {/* Results */}
        {active && matches.length === 0 && (
          <p className="text-xs text-center text-muted-foreground py-2">
            No localities within this budget
          </p>
        )}

        {active && matches.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Top {matches.length} localities within budget
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {matches.map((l) => {
                const median =
                  bhk === 1
                    ? l.median_1bhk_lakhs ?? 0
                    : bhk === 2
                    ? l.median_2bhk_lakhs
                    : l.median_3bhk_lakhs;
                return (
                  <button
                    key={l.name}
                    onClick={() => onLocalityClick(l.name)}
                    className="flex items-center justify-between bg-[#d0e8da]/40 dark:bg-[#1a3528]/40 border border-primary/20 rounded-lg px-3 py-2.5 text-left hover:bg-[#d0e8da]/70 dark:hover:bg-[#1a3528]/70 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-primary flex-shrink-0" />
                        {l.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {bhk} BHK median: {formatLakhs(median)}
                      </p>
                    </div>
                    <p className="text-xs font-medium text-primary flex-shrink-0 ml-2">
                      {formatPricePerSqft(l.avg_price_per_sqft)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
