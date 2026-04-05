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
import { ChevronUp, ChevronDown, Search } from "lucide-react";
import { formatPricePerSqft, formatLakhs } from "@/lib/utils/format";

interface Locality {
  name: string;
  avg_price_per_sqft: number;
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
}

type SortKey = "avg_price_per_sqft" | "median_2bhk_lakhs" | "median_3bhk_lakhs" | "listing_count";

export function LocalityRankingTable({
  localities,
  onSelectLocality,
  selectedLocality,
}: LocalityRankingTableProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("avg_price_per_sqft");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showAll, setShowAll] = useState(false);

  const sorted = useMemo(() => {
    return [...localities]
      .filter((l) => l.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        return sortDir === "desc" ? bVal - aVal : aVal - bVal;
      });
  }, [localities, search, sortKey, sortDir]);

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
            {displayed.map((locality) => (
              <TableRow
                key={locality.name}
                className={`cursor-pointer transition-colors ${
                  selectedLocality === locality.name
                    ? "bg-primary-highlight"
                    : "hover:bg-muted/50"
                }`}
                onClick={() => onSelectLocality(locality)}
              >
                <TableCell className="font-medium">{locality.name}</TableCell>
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
            ))}
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
