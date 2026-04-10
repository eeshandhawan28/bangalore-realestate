"use client";

import { Property } from "@/lib/portfolio";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, RefreshCw, MapPin } from "lucide-react";
import { formatLakhs } from "@/lib/utils/format";
import marketStats from "@/lib/data/market_stats.json";

function holdingPeriod(purchaseDate: string): string {
  const start = new Date(purchaseDate);
  const now = new Date();
  const months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  if (months < 12) return `${months}m`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m === 0 ? `${y}y` : `${y}y ${m}m`;
}

function marketContext(
  purchasePriceLakhs: number,
  totalSqft: number,
  location: string
): { label: string; color: string } | null {
  const loc = marketStats.localities.find(
    (l) => l.name.toLowerCase() === location.toLowerCase()
  );
  if (!loc) return null;
  const buyPricePerSqft = (purchasePriceLakhs * 100000) / totalSqft;
  const diff = ((buyPricePerSqft - loc.avg_price_per_sqft) / loc.avg_price_per_sqft) * 100;
  if (diff < -5)
    return { label: `${Math.abs(diff).toFixed(0)}% below locality avg`, color: "text-[#437a22] dark:text-[#6fbc3a]" };
  if (diff > 5)
    return { label: `${diff.toFixed(0)}% above locality avg`, color: "text-[#92400e] dark:text-[#fbbf24]" };
  return { label: "At locality avg", color: "text-muted-foreground" };
}

interface PropertyCardProps {
  property: Property;
  onEdit: (property: Property) => void;
  onDelete: (id: string) => void;
  onRefresh: (property: Property) => void;
  onClick: (property: Property) => void;
}

const ownershipColors: Record<string, string> = {
  "self-occupied": "bg-[#d0e8da] text-[#1a5c3a] dark:bg-[#1a3528] dark:text-[#6fbc3a]",
  rented: "bg-[#dceef8] text-[#006494] dark:bg-[#0a2030] dark:text-[#4da9d8]",
  "under-construction": "bg-[#fef3c7] text-[#92400e] dark:bg-[#2a1a00] dark:text-[#fbbf24]",
};

export function PropertyCard({
  property,
  onEdit,
  onDelete,
  onRefresh,
  onClick,
}: PropertyCardProps) {
  const currentValue =
    property.ai_estimated_value_lakhs ?? property.purchase_price_lakhs;
  const gain = currentValue - property.purchase_price_lakhs;
  const gainPercent =
    property.purchase_price_lakhs > 0
      ? (gain / property.purchase_price_lakhs) * 100
      : 0;
  const isPositive = gain >= 0;
  const held = holdingPeriod(property.purchase_date);
  const mktCtx = marketContext(property.purchase_price_lakhs, property.total_sqft, property.location);
  const buyPsf = Math.round((property.purchase_price_lakhs * 100000) / property.total_sqft);

  return (
    <Card
      className="bg-surface border-border shadow-sm cursor-pointer transition-all duration-200 ease-out hover:shadow-md hover:-translate-y-1 hover:border-primary/20"
      onClick={() => onClick(property)}
    >
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">
              {property.name}
            </h3>
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <p className="text-xs text-muted-foreground truncate">
                {property.location}
              </p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 -mr-1">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(property);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onRefresh(property);
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Valuation
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(property.id);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Property details */}
        <div className="flex gap-2 mb-4">
          <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-md">
            {property.bhk} BHK
          </span>
          <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-md">
            {property.total_sqft.toLocaleString("en-IN")} sqft
          </span>
          <span
            className={`text-xs px-2 py-1 rounded-md capitalize ${
              ownershipColors[property.ownership_type]
            }`}
          >
            {property.ownership_type.replace("-", " ")}
          </span>
          <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-md">
            {held}
          </span>
        </div>

        {/* Price comparison */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Purchased</span>
            <span className="font-medium">
              {formatLakhs(property.purchase_price_lakhs)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Current Est.</span>
            <span className="font-semibold text-foreground">
              {formatLakhs(currentValue)}
            </span>
          </div>
        </div>

        {/* Gain/Loss + Market Context */}
        <div className="mt-3 pt-3 border-t border-border space-y-1.5">
          <Badge
            className={`text-xs font-semibold ${
              isPositive
                ? "bg-[#d0e8da] text-[#437a22] dark:bg-[#1a3528] dark:text-[#6fbc3a] hover:bg-[#d0e8da]"
                : "bg-[#f5d0d5] text-[#a13544] dark:bg-[#3a1520] dark:text-[#e05c6e] hover:bg-[#f5d0d5]"
            }`}
          >
            {isPositive ? "+" : ""}
            {formatLakhs(gain)} ({isPositive ? "+" : ""}
            {gainPercent.toFixed(1)}%)
          </Badge>
          <p className={`text-xs ${mktCtx?.color ?? "text-muted-foreground"}`}>
            ₹{buyPsf.toLocaleString("en-IN")}/sqft
            {mktCtx ? ` · ${mktCtx.label}` : ""}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
