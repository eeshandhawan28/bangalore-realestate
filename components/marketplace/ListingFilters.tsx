"use client";

import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface FilterState {
  listingType: "all" | "sale" | "rent";
  bhk: number[];
  sortBy: "newest" | "price_asc" | "price_desc" | "best_value";
}

interface ListingFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

const BHK_OPTIONS = [1, 2, 3, 4];
const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "best_value", label: "Best Value" },
];

export function ListingFilters({ filters, onChange }: ListingFiltersProps) {
  const toggleBhk = (bhk: number) => {
    const current = filters.bhk;
    const updated = current.includes(bhk)
      ? current.filter((b) => b !== bhk)
      : [...current, bhk];
    onChange({ ...filters, bhk: updated });
  };

  return (
    <div className="space-y-5">
      {/* Listing Type */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Listing Type
        </Label>
        <div className="flex gap-2">
          {(["all", "sale", "rent"] as const).map((type) => (
            <button
              key={type}
              onClick={() => onChange({ ...filters, listingType: type })}
              className={cn(
                "flex-1 py-1.5 rounded-lg border text-xs font-medium capitalize transition-colors",
                filters.listingType === type
                  ? "bg-primary text-white border-primary"
                  : "bg-surface border-border hover:border-primary"
              )}
            >
              {type === "all" ? "All" : type === "sale" ? "For Sale" : "For Rent"}
            </button>
          ))}
        </div>
      </div>

      <Separator />

      {/* BHK */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          BHK
        </Label>
        <div className="flex gap-2 flex-wrap">
          {BHK_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => toggleBhk(n)}
              className={cn(
                "w-10 h-10 rounded-lg border text-sm font-medium transition-colors",
                filters.bhk.includes(n)
                  ? "bg-primary text-white border-primary"
                  : "bg-surface border-border hover:border-primary"
              )}
            >
              {n === 4 ? "4+" : n}
            </button>
          ))}
        </div>
      </div>

      <Separator />

      {/* Sort */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Sort By
        </Label>
        <div className="space-y-1">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() =>
                onChange({
                  ...filters,
                  sortBy: opt.value as FilterState["sortBy"],
                })
              }
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                filters.sortBy === opt.value
                  ? "bg-primary-highlight text-primary font-medium"
                  : "hover:bg-muted text-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
