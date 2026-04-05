"use client";

import { ValuationResult as VResult } from "@/lib/valuation";
import { formatLakhs, formatLakhsShort, formatPricePerSqft } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface ValuationResultProps {
  result: VResult;
}

export function ValuationResult({ result }: ValuationResultProps) {
  const {
    predicted_price_lakhs,
    lower_bound,
    upper_bound,
    price_per_sqft,
    locality_avg_price_per_sqft,
    locality_name,
    locality_min_price_per_sqft,
    locality_max_price_per_sqft,
    comparable_properties,
  } = result;

  // Position of estimated price on the min-max scale (0-100%)
  const markerPosition = Math.min(
    100,
    Math.max(
      0,
      ((price_per_sqft - locality_min_price_per_sqft) /
        (locality_max_price_per_sqft - locality_min_price_per_sqft)) *
        100
    )
  );

  return (
    <div className="space-y-6">
      {/* Main estimate */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <p className="text-sm text-muted-foreground mb-1">Estimated Value</p>
        <p className="font-display text-4xl font-semibold text-foreground">
          {formatLakhs(predicted_price_lakhs)}
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Range:{" "}
          <span className="text-foreground font-medium">
            {formatLakhsShort(lower_bound)} – {formatLakhsShort(upper_bound)}
          </span>
        </p>

        <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Price per sqft</p>
            <p className="font-medium text-sm">
              {formatPricePerSqft(price_per_sqft)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              {locality_name} avg
            </p>
            <p className="font-medium text-sm">
              {formatPricePerSqft(locality_avg_price_per_sqft)}
            </p>
          </div>
        </div>
      </div>

      {/* Price distribution bar */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">
          {locality_name} Price Range (₹/sqft)
        </p>
        <div className="relative h-3 rounded-full bg-muted overflow-visible">
          <div
            className="absolute top-1/2 -translate-y-1/2 h-3 rounded-full bg-gradient-to-r from-[#d0e8da] to-[#1a5c3a]"
            style={{ width: "100%" }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-primary border-2 border-white shadow-md"
            style={{ left: `calc(${markerPosition}% - 8px)` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>₹{locality_min_price_per_sqft.toLocaleString("en-IN")}</span>
          <span className="text-primary font-medium">
            ₹{price_per_sqft.toLocaleString("en-IN")} (yours)
          </span>
          <span>₹{locality_max_price_per_sqft.toLocaleString("en-IN")}</span>
        </div>
      </div>

      {/* Comparables */}
      {comparable_properties.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Comparable Properties</p>
          <div className="space-y-2">
            {comparable_properties.map((comp, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-surface border border-border"
              >
                <div>
                  <p className="text-sm font-medium">
                    {comp.bhk}BHK · {comp.location}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ~{comp.sqft.toLocaleString("en-IN")} sqft
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">
                    {formatLakhsShort(comp.price_lakhs)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatPricePerSqft(comp.price_per_sqft)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTAs */}
      <div className="flex gap-3">
        <Button
          asChild
          className="flex-1 bg-primary hover:bg-primary-hover text-white"
        >
          <Link href="/portfolio">Save to Portfolio</Link>
        </Button>
        <Button asChild variant="outline" className="flex-1">
          <Link href="/marketplace/list">List on Marketplace</Link>
        </Button>
      </div>
    </div>
  );
}
