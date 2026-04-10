"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, Search, CheckCircle2 } from "lucide-react";
import { formatPricePerSqft, formatLakhs } from "@/lib/utils/format";

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

interface LocalityRankingTableProps {
  localities: Locality[];
  onSelectLocality: (locality: Locality) => void;
  selectedLocality: string | null;
  budgetFilter?: { budget: number; bhk: 1 | 2 | 3 } | null;
}

type SortKey = "avg_price_per_sqft" | "median_2bhk_lakhs" | "median_3bhk_lakhs" | "listing_count";

export function LocalityRankingTable({
  localities,
  onSelectLocality,
  selectedLocality,
  budgetFilter,
}: LocalityRankingTableProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("avg_price_per_sqft");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showAll, setShowAll] = useState(false);

  const medianKey = budgetFilter
    ? budgetFilter.bhk === 1
      ? "median_1bhk_lakhs"
      : budgetFilter.bhk === 2
      ? "median_2bhk_lakhs"
      : "median_3bhk_lakhs"
    : null;

  const isWithinBudget = (locality: Locality) => {
    if (!budgetFilter || !medianKey) return false;
    const median =
      medianKey === "median_1bhk_lakhs"
        ? locality.median_1bhk_lakhs ?? Infinity
        : locality[medianKey as "median_2bhk_lakhs" | "median_3bhk_lakhs"];
    return median <= budgetFilter.budget;
  };

  const sorted = useMemo(() => {
    const filtered = [...localities].filter((l) =>
      l.name.toLowerCase().includes(search.toLowerCase())
    );

    filtered.sort((a, b) => {
      // If budget filter active, sort matching rows to top
      if (budgetFilter) {
        const aIn = isWithinBudget(a);
        const bIn = isWithinBudget(b);
        if (aIn && !bIn) return -1;
        if (!aIn && bIn) return 1;
      }
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });

    return filtered;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localities, search, sortKey, sortDir, budgetFilter]);

  const displayed = showAll ? sorted : sorted.slice(0, 20);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col)
      return <ChevronUp className="w-3 h-3 opacity-30 inline ml-1" />;
    return sortDir === "desc" ? (
      <ChevronDown className="w-3 h-3 inline ml-1 text-primary" />
    ) : (
      <ChevronUp className="w-3 h-3 inline ml-1 text-primary" />
    );
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

      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold text-foreground">
                Locality
              </TableHead>
              <TableHead
                className="font-semibold text-foreground cursor-pointer hover:text-primary"
                onClick={() => handleSort("avg_price_per_sqft")}
              >
                Avg ₹/sqft <SortIcon col="avg_price_per_sqft" />
              </TableHead>
              <TableHead
                className="font-semibold text-foreground cursor-pointer hover:text-primary hidden sm:table-cell"
                onClick={() => handleSort("median_2bhk_lakhs")}
              >
                2BHK Median <SortIcon col="median_2bhk_lakhs" />
              </TableHead>
              <TableHead
                className="font-semibold text-foreground cursor-pointer hover:text-primary hidden md:table-cell"
                onClick={() => handleSort("median_3bhk_lakhs")}
              >
                3BHK Median <SortIcon col="median_3bhk_lakhs" />
              </TableHead>
              <TableHead
                className="font-semibold text-foreground cursor-pointer hover:text-primary hidden lg:table-cell"
                onClick={() => handleSort("listing_count")}
              >
                Listings <SortIcon col="listing_count" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayed.map((locality) => {
              const withinBudget = budgetFilter ? isWithinBudget(locality) : null;
              return (
              <TableRow
                key={locality.name}
                className={`cursor-pointer transition-colors ${
                  selectedLocality === locality.name
                    ? "bg-primary-highlight"
                    : withinBudget === true
                    ? "bg-[#d0e8da]/40 dark:bg-[#1a3528]/40 hover:bg-[#d0e8da]/60"
                    : withinBudget === false
                    ? "opacity-40 hover:opacity-60"
                    : "hover:bg-muted/50"
                }`}
                onClick={() => onSelectLocality(locality)}
              >
                <TableCell className="font-medium">
                  <span className="flex items-center gap-1.5">
                    {withinBudget === true && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    )}
                    {locality.name}
                  </span>
                </TableCell>
                <TableCell>
                  {formatPricePerSqft(locality.avg_price_per_sqft)}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  {formatLakhs(locality.median_2bhk_lakhs)}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {formatLakhs(locality.median_3bhk_lakhs)}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-muted-foreground">
                  {locality.listing_count}
                </TableCell>
              </TableRow>
            );
            })}
          </TableBody>
        </Table>
      </div>

      {sorted.length > 20 && !showAll && (
        <div className="text-center">
          <Button variant="outline" onClick={() => setShowAll(true)}>
            Show all {sorted.length} localities
          </Button>
        </div>
      )}
    </div>
  );
}
