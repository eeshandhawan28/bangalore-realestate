"use client";

import { PortfolioSummary } from "@/lib/portfolio";
import { Building2, TrendingUp, TrendingDown, Wallet } from "lucide-react";

interface PortfolioSummaryBarProps {
  summary: PortfolioSummary;
}

export function PortfolioSummaryBar({ summary }: PortfolioSummaryBarProps) {
  const { totalValue, totalInvested, totalReturn, returnPercent, count } = summary;
  const isPositive = totalReturn >= 0;

  const cards = [
    {
      label: "Total Portfolio Value",
      value: formatValue(totalValue),
      icon: Building2,
      iconColor: "text-primary",
      iconBg: "bg-primary-highlight",
    },
    {
      label: "Total Invested",
      value: formatValue(totalInvested),
      icon: Wallet,
      iconColor: "text-[#006494]",
      iconBg: "bg-[#e0f0f8] dark:bg-[#0a2030]",
    },
    {
      label: "Overall Return",
      value: `${isPositive ? "+" : ""}${formatValue(Math.abs(totalReturn))} (${isPositive ? "+" : "-"}${Math.abs(returnPercent).toFixed(1)}%)`,
      icon: isPositive ? TrendingUp : TrendingDown,
      iconColor: isPositive ? "text-[#437a22]" : "text-[#a13544]",
      iconBg: isPositive
        ? "bg-[#d8f0c8] dark:bg-[#1a2e10]"
        : "bg-[#f5d0d5] dark:bg-[#2e1015]",
      valueColor: isPositive ? "text-[#437a22]" : "text-[#a13544]",
    },
    {
      label: "Properties",
      value: count.toString(),
      icon: Building2,
      iconColor: "text-primary",
      iconBg: "bg-primary-highlight",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="bg-surface border border-border rounded-xl p-4 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center ${card.iconBg}`}
              >
                <Icon className={`w-4 h-4 ${card.iconColor}`} />
              </div>
              <p className="text-xs text-muted-foreground font-medium">
                {card.label}
              </p>
            </div>
            <p
              className={`font-display font-semibold text-lg ${
                card.valueColor ?? "text-foreground"
              }`}
            >
              {card.value}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function formatValue(value: number): string {
  if (value >= 10000000) {
    return `₹${(value / 10000000).toFixed(2)} Cr`;
  }
  if (value >= 100000) {
    return `₹${(value / 100000).toFixed(1)} L`;
  }
  return `₹${value.toFixed(0)}`;
}
