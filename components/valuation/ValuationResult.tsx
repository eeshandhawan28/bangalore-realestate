"use client";

import { useState, useEffect } from "react";
import { ValuationResult as VResult, LocalitySentiment } from "@/lib/valuation";
import { formatLakhs, formatLakhsShort, formatPricePerSqft } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus as TrendingFlat, MapPin } from "lucide-react";

interface ValuationResultProps {
  result: VResult;
}

function adjustmentLabel(key: string): string {
  const labels: Record<string, string> = {
    sqft: "Size vs typical",
    area_type: "Area type",
    bathrooms: "Extra bathrooms",
    balconies: "Balconies",
    age: "Property age",
    floor: "Floor level",
    sentiment: "Local development sentiment",
  };
  return labels[key] ?? key;
}

export function ValuationResult({ result }: ValuationResultProps) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [liveSentiment, setLiveSentiment] = useState<
    (LocalitySentiment & { updated_at: string | null; source: string }) | null
  >(null);

  // Fetch live sentiment from API after initial render
  useEffect(() => {
    const locality = result.locality_name;
    if (!locality) return;
    fetch(`/api/sentiment/${encodeURIComponent(locality)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data && !data.error) {
          setLiveSentiment({
            score: data.sentiment_score,
            trend: data.trend,
            impact_pct: Math.round(data.sentiment_score * 100 * 10) / 10,
            highlights: data.highlights,
            updated_at: data.updated_at,
            source: data.source,
          });
        }
      })
      .catch(() => {/* silently use props fallback */});
  }, [result.locality_name]);

  const {
    predicted_price_lakhs,
    lower_bound,
    upper_bound,
    confidence_half_width_pct,
    price_per_sqft,
    locality_avg_price_per_sqft,
    locality_name,
    locality_min_price_per_sqft,
    locality_max_price_per_sqft,
    comparable_properties,
    price_adjustments,
    locality_sentiment,
  } = result;

  const confidencePct = Math.round(confidence_half_width_pct * 100);

  // Prefer live (Supabase) sentiment over static JSON, with graceful fallback
  const activeSentiment = liveSentiment ?? locality_sentiment;

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

  const adjustmentEntries = Object.entries(price_adjustments).filter(
    ([, v]) => v !== 0
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
          <span className="text-xs text-muted-foreground ml-1.5">
            (±{confidencePct}% based on locality spread)
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

      {/* Locality Sentiment Intelligence */}
      {activeSentiment && (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">
                Local Development Intelligence
              </span>
              {liveSentiment?.updated_at && (
                <span className="text-xs text-muted-foreground">
                  · updated{" "}
                  {new Date(liveSentiment.updated_at).toLocaleDateString(
                    "en-IN",
                    { day: "numeric", month: "short" }
                  )}
                </span>
              )}
              {liveSentiment?.source === "static" && (
                <span className="text-xs text-muted-foreground">· baseline data</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {activeSentiment.trend === "up" ? (
                <TrendingUp className="w-4 h-4 text-green-500" />
              ) : activeSentiment.trend === "down" ? (
                <TrendingDown className="w-4 h-4 text-red-400" />
              ) : (
                <TrendingFlat className="w-4 h-4 text-muted-foreground" />
              )}
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  activeSentiment.trend === "up"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                    : activeSentiment.trend === "down"
                    ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {activeSentiment.impact_pct > 0 ? "+" : ""}
                {activeSentiment.impact_pct}% sentiment impact
              </span>
            </div>
          </div>
          <ul className="px-4 py-3 space-y-2">
            {activeSentiment.highlights.map((h, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                {h}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* How was this estimated — collapsible breakdown */}
      {adjustmentEntries.length > 0 && (
        <div className="border border-border rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowBreakdown((p) => !p)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
          >
            <span>How was this estimated?</span>
            {showBreakdown ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          {showBreakdown && (
            <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
              <p className="text-xs text-muted-foreground mb-3">
                Starting from the {locality_name} median price, these factors
                were applied:
              </p>
              {adjustmentEntries.map(([key, value]) => {
                const isPositive = value > 0;
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-muted-foreground">
                      {adjustmentLabel(key)}
                    </span>
                    <span
                      className={
                        isPositive
                          ? "text-green-600 dark:text-green-400 font-medium"
                          : "text-red-500 dark:text-red-400 font-medium"
                      }
                    >
                      {isPositive ? "+" : ""}
                      {value}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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
