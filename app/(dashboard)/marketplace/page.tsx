"use client";

import { useState, useMemo } from "react";
import sampleListings from "@/lib/data/sample_listings.json";
import { ListingCard } from "@/components/marketplace/ListingCard";
import { ListingMap } from "@/components/marketplace/ListingMap";
import { ListingFilters, FilterState } from "@/components/marketplace/ListingFilters";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SlidersHorizontal, Plus, Map, LayoutGrid } from "lucide-react";
import Link from "next/link";

type Listing = (typeof sampleListings)[0];

export default function MarketplacePage() {
  const [filters, setFilters] = useState<FilterState>({
    listingType: "all",
    bhk: [],
    sortBy: "newest",
  });
  const [view, setView] = useState<"grid" | "map">("map");

  const filtered = useMemo(() => {
    let result: Listing[] = [...sampleListings];

    if (filters.listingType !== "all") {
      result = result.filter((l) => l.listing_type === filters.listingType);
    }

    if (filters.bhk.length > 0) {
      result = result.filter((l) =>
        filters.bhk.some((b) => (b === 4 ? l.bhk >= 4 : l.bhk === b))
      );
    }

    switch (filters.sortBy) {
      case "price_asc":
        result.sort(
          (a, b) =>
            (a.asking_price_lakhs ?? 0) - (b.asking_price_lakhs ?? 0)
        );
        break;
      case "price_desc":
        result.sort(
          (a, b) =>
            (b.asking_price_lakhs ?? 0) - (a.asking_price_lakhs ?? 0)
        );
        break;
      case "best_value":
        result.sort((a, b) => {
          const diffA =
            a.asking_price_lakhs && a.ai_estimated_price_lakhs
              ? ((a.ai_estimated_price_lakhs - a.asking_price_lakhs) /
                  a.ai_estimated_price_lakhs) *
                100
              : -999;
          const diffB =
            b.asking_price_lakhs && b.ai_estimated_price_lakhs
              ? ((b.ai_estimated_price_lakhs - b.asking_price_lakhs) /
                  b.ai_estimated_price_lakhs) *
                100
              : -999;
          return diffB - diffA;
        });
        break;
      case "newest":
      default:
        result.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }

    return result;
  }, [filters]);

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">
            Marketplace
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} listing{filtered.length !== 1 ? "s" : ""} with AI
            fair value analysis
          </p>
        </div>
        <div className="flex gap-2">
          {/* View toggle */}
          <div className="flex border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setView("map")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                view === "map"
                  ? "bg-primary text-white"
                  : "bg-surface text-muted-foreground hover:text-foreground"
              }`}
            >
              <Map className="w-3.5 h-3.5" />
              Map
            </button>
            <button
              onClick={() => setView("grid")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                view === "grid"
                  ? "bg-primary text-white"
                  : "bg-surface text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Grid
            </button>
          </div>

          {/* Mobile filter trigger */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="lg:hidden">
                <SlidersHorizontal className="w-4 h-4 mr-2" />
                Filters
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="bg-surface border-border w-[280px]"
            >
              <SheetHeader>
                <SheetTitle className="font-display">Filters</SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <ListingFilters filters={filters} onChange={setFilters} />
              </div>
            </SheetContent>
          </Sheet>

          <Button asChild className="bg-primary hover:bg-primary-hover text-white" size="sm">
            <Link href="/marketplace/list">
              <Plus className="w-4 h-4 mr-2" />
              List Property
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar filters (desktop) */}
        <aside className="hidden lg:block w-56 flex-shrink-0">
          <div className="bg-surface border border-border rounded-xl p-5 sticky top-6">
            <h2 className="font-semibold text-sm mb-4">Filters</h2>
            <ListingFilters filters={filters} onChange={setFilters} />
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1">
          {view === "map" ? (
            <div style={{ height: "calc(100vh - 220px)", minHeight: "500px" }}>
              <ListingMap listings={filtered as Parameters<typeof ListingMap>[0]["listings"]} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground">
                No listings match your filters.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((listing) => (
                <ListingCard key={listing.id} listing={listing as Parameters<typeof ListingCard>[0]["listing"]} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
