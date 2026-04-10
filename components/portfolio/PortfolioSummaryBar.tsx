"use client";

import { PortfolioSummary } from "@/lib/portfolio";
import { formatLakhs } from "@/lib/utils/format";
import { Building2, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import CountUp from "react-countup";

function parseFormatted(formatted: string): { prefix: string; value: number; suffix: string } {
  const match = formatted.match(/^(₹)([\d.]+)\s*(.*)$/);
  if (!match) return { prefix: "", value: 0, suffix: formatted };
  return { prefix: match[1], value: parseFloat(match[2]), suffix: match[3] ? " " + match[3] : "" };
}

interface PortfolioSummaryBarProps {
  summary: PortfolioSummary;
}

export function PortfolioSummaryBar({ summary }: PortfolioSummaryBarProps) {
  const { totalValue, totalInvested, totalReturn, returnPercent, count } = summary;
  const isPositive = totalReturn >= 0;

  const cards = [
    {
      label: "Total Portfolio Value",
      value: formatLakhs(totalValue),
      icon: Building2,
      iconColor: "text-primary",
      iconBg: "bg-primary-highlight",
    },
    {
      label: "Total Invested",
      value: formatLakhs(totalInvested),
      icon: Wallet,
      iconColor: "text-[#006494]",
      iconBg: "bg-[#e0f0f8] dark:bg-[#0a2030]",
    },
    {
      label: "Overall Return",
      value: `${isPositive ? "+" : "-"}${formatLakhs(Math.abs(totalReturn))} (${isPositive ? "+" : "-"}${Math.abs(returnPercent).toFixed(1)}%)`,
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

  const delays = ["delay-1", "delay-2", "delay-3", "delay-4"];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        const parsed = parseFormatted(card.value);
        const canAnimate = parsed.value > 0 && !card.value.includes("(");
        return (
          <div
            key={card.label}
            className={`bg-surface border border-border rounded-xl p-4 shadow-sm animate-fade-in-up ${delays[index]} transition-all duration-200 ease-out hover:shadow-md hover:-translate-y-0.5 hover:border-primary/20`}
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
              {canAnimate ? (
                <CountUp
                  start={0}
                  end={parsed.value}
                  duration={1.2}
                  decimals={parsed.suffix.includes("Cr") ? 2 : parsed.suffix.includes("L") ? 1 : 0}
                  prefix={parsed.prefix}
                  suffix={parsed.suffix}
                  useEasing
                />
              ) : (
                card.value
              )}
            </p>
          </div>
        );
      })}
    </div>
  );
}

