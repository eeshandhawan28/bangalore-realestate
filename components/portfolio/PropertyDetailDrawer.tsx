"use client";

import { Property } from "@/lib/portfolio";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatLakhs, formatPricePerSqft } from "@/lib/utils/format";
import marketStats from "@/lib/data/market_stats.json";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface PropertyDetailDrawerProps {
  property: Property | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function buildChartData(property: Property) {
  const purchaseYear = new Date(property.purchase_date).getFullYear();
  const currentYear = new Date().getFullYear();
  const purchaseValue = property.purchase_price_lakhs;
  const currentValue =
    property.ai_estimated_value_lakhs ?? property.purchase_price_lakhs;

  const years = Math.max(currentYear - purchaseYear, 1);
  const points = [];

  for (let i = 0; i <= years; i++) {
    const year = purchaseYear + i;
    const value =
      purchaseValue + ((currentValue - purchaseValue) * i) / years;
    points.push({ year: year.toString(), value: Math.round(value * 10) / 10 });
  }

  return points;
}

export function PropertyDetailDrawer({
  property,
  open,
  onOpenChange,
}: PropertyDetailDrawerProps) {
  if (!property) return null;

  const chartData = buildChartData(property);
  const currentValue =
    property.ai_estimated_value_lakhs ?? property.purchase_price_lakhs;

  // Rental yield
  const monthlyRent = Math.round((currentValue * 100000 * 0.003) / 1000) * 1000;
  const annualRent = monthlyRent * 12;
  const rentalYield = ((annualRent / (currentValue * 100000)) * 100).toFixed(1);
  const pricePerSqft = Math.round((currentValue * 100000) / property.total_sqft);

  // CAGR
  const purchaseYear = new Date(property.purchase_date);
  const holdingYears = (Date.now() - purchaseYear.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  const cagr =
    holdingYears > 0.5 && property.purchase_price_lakhs > 0
      ? ((Math.pow(currentValue / property.purchase_price_lakhs, 1 / holdingYears) - 1) * 100).toFixed(1)
      : null;

  // Market comparison
  const buyPsf = Math.round((property.purchase_price_lakhs * 100000) / property.total_sqft);
  const localityData = marketStats.localities.find(
    (l) => l.name.toLowerCase() === property.location.toLowerCase()
  );
  const localityAvgPsf = localityData?.avg_price_per_sqft ?? null;
  const cityAvgPsf = marketStats.city_summary.avg_price_per_sqft;
  const vsLocalityPct =
    localityAvgPsf != null
      ? ((buyPsf - localityAvgPsf) / localityAvgPsf) * 100
      : null;
  const vsLocalityLabel =
    vsLocalityPct == null
      ? null
      : vsLocalityPct < -5
      ? { text: `${Math.abs(vsLocalityPct).toFixed(0)}% below avg ✓`, color: "text-[#437a22] dark:text-[#6fbc3a]" }
      : vsLocalityPct > 5
      ? { text: `${vsLocalityPct.toFixed(0)}% above avg`, color: "text-[#92400e] dark:text-[#fbbf24]" }
      : { text: "At market avg", color: "text-muted-foreground" };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:w-[480px] bg-surface border-border overflow-y-auto"
      >
        <SheetHeader className="mb-6">
          <SheetTitle className="font-display text-left">
            {property.name}
          </SheetTitle>
        </SheetHeader>

        {/* Property Details */}
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["Location", property.location],
              ["Area Type", property.area_type],
              ["Size", `${property.total_sqft.toLocaleString("en-IN")} sqft`],
              ["BHK", `${property.bhk} BHK`],
              ["Bathrooms", property.bathrooms.toString()],
              ["Balconies", property.balconies.toString()],
              ["Price/sqft", formatPricePerSqft(pricePerSqft)],
              ["Ownership", property.ownership_type.replace("-", " ")],
            ].map(([label, value]) => (
              <div key={label} className="bg-muted rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                <p className="font-medium capitalize">{value}</p>
              </div>
            ))}
          </div>

          {/* Value summary */}
          <div className="bg-primary-highlight dark:bg-[#1a3528] rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Purchased</span>
              <span className="font-semibold">
                {formatLakhs(property.purchase_price_lakhs)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">AI Est. Value</span>
              <span className="font-semibold text-primary">
                {formatLakhs(currentValue)}
              </span>
            </div>
            {cagr != null && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">CAGR</span>
                <span className={`font-semibold ${Number(cagr) >= 0 ? "text-[#437a22] dark:text-[#6fbc3a]" : "text-destructive"}`}>
                  {Number(cagr) >= 0 ? "+" : ""}{cagr}% p.a.
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm pt-2 border-t border-border">
              <span className="text-muted-foreground">Est. Rental Yield</span>
              <span className="font-semibold">~{rentalYield}% p.a.</span>
            </div>
          </div>

          {/* Market Comparison */}
          <div className="bg-muted rounded-xl p-4 space-y-2">
            <p className="text-sm font-semibold text-foreground mb-1">Market Comparison</p>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Your buy price</span>
              <span className="font-medium">{formatPricePerSqft(buyPsf)}</span>
            </div>
            {localityAvgPsf != null && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{property.location} avg now</span>
                <span className="font-medium">{formatPricePerSqft(localityAvgPsf)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Bangalore avg</span>
              <span className="font-medium">{formatPricePerSqft(cityAvgPsf)}</span>
            </div>
            {vsLocalityLabel && (
              <div className="flex justify-between text-sm pt-2 border-t border-border">
                <span className="text-muted-foreground">vs locality avg</span>
                <span className={`font-semibold ${vsLocalityLabel.color}`}>
                  {vsLocalityLabel.text}
                </span>
              </div>
            )}
          </div>

          {/* Value over time chart */}
          <div>
            <p className="text-sm font-medium mb-3">Value Over Time</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                  />
                  <XAxis
                    dataKey="year"
                    tick={{ fontSize: 11, fill: "var(--color-muted-fg)" }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--color-muted-fg)" }}
                    tickFormatter={(v) => `₹${v}L`}
                    width={52}
                  />
                  <Tooltip
                    formatter={(value) => [
                      `₹${value}L`,
                      "Est. Value",
                    ]}
                    contentStyle={{
                      backgroundColor: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    dot={{ fill: "var(--color-primary)", r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Notes */}
          {property.notes && (
            <div>
              <p className="text-sm font-medium mb-1">Notes</p>
              <p className="text-sm text-muted-foreground bg-muted rounded-lg p-3">
                {property.notes}
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
