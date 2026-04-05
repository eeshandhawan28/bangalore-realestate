"use client";

import { Property } from "@/lib/portfolio";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatLakhs, formatPricePerSqft } from "@/lib/utils/format";
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

  // Rough rental yield estimate: ~3.6% annual yield (0.3% monthly)
  const monthlyRent = Math.round((currentValue * 100000 * 0.003) / 1000) * 1000;
  const annualRent = monthlyRent * 12;
  const rentalYield = ((annualRent / (currentValue * 100000)) * 100).toFixed(1);
  const pricePerSqft = Math.round((currentValue * 100000) / property.total_sqft);

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
            <div className="flex justify-between text-sm pt-2 border-t border-border">
              <span className="text-muted-foreground">Est. Rental Yield</span>
              <span className="font-semibold">~{rentalYield}% p.a.</span>
            </div>
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
