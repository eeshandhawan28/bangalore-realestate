"use client";

import { Property } from "@/lib/portfolio";
import marketStats from "@/lib/data/market_stats.json";

interface PortfolioInsightsProps {
  properties: Property[];
}

interface Insight {
  icon: string;
  text: string;
  type: "positive" | "warning" | "neutral";
}

function getLocalityAvg(location: string): number | null {
  const loc = marketStats.localities.find(
    (l) => l.name.toLowerCase() === location.toLowerCase()
  );
  return loc?.avg_price_per_sqft ?? null;
}

export function PortfolioInsights({ properties }: PortfolioInsightsProps) {
  if (properties.length < 2) return null;

  const insights: Insight[] = [];

  // Compute gain data per property
  const withGain = properties.map((p) => {
    const current = p.ai_estimated_value_lakhs ?? p.purchase_price_lakhs;
    const gain = current - p.purchase_price_lakhs;
    const gainPct =
      p.purchase_price_lakhs > 0 ? (gain / p.purchase_price_lakhs) * 100 : 0;
    const purchasePricePerSqft =
      (p.purchase_price_lakhs * 100000) / p.total_sqft;
    const localityAvg = getLocalityAvg(p.location);
    const vsMktPct =
      localityAvg != null
        ? ((purchasePricePerSqft - localityAvg) / localityAvg) * 100
        : null;
    return { ...p, current, gain, gainPct, vsMktPct };
  });

  // 1. Best performer
  const best = withGain.reduce((a, b) => (b.gainPct > a.gainPct ? b : a));
  if (best.gainPct > 0) {
    insights.push({
      icon: "🏆",
      text: `${best.name} is your best performer at +${best.gainPct.toFixed(1)}%`,
      type: "positive",
    });
  }

  // 2. Best entry price (bought well below market)
  const goodBuys = withGain.filter(
    (p) => p.vsMktPct != null && p.vsMktPct < -8
  );
  if (goodBuys.length > 0) {
    const top = goodBuys.reduce((a, b) =>
      (b.vsMktPct ?? 0) < (a.vsMktPct ?? 0) ? b : a
    );
    insights.push({
      icon: "📍",
      text: `You bought ${top.name} ${Math.abs(top.vsMktPct!).toFixed(0)}% below today's locality avg — strong entry price`,
      type: "positive",
    });
  }

  // 3. Underperformer alert
  const worst = withGain.reduce((a, b) => (b.gainPct < a.gainPct ? b : a));
  if (worst.gainPct < -5) {
    insights.push({
      icon: "⚠️",
      text: `${worst.name} is down ${Math.abs(worst.gainPct).toFixed(1)}% — consider reviewing this holding`,
      type: "warning",
    });
  }

  // 4. Concentration risk
  const totalValue = withGain.reduce((s, p) => s + p.current, 0);
  const byLocality = withGain.reduce<Record<string, number>>((acc, p) => {
    acc[p.location] = (acc[p.location] ?? 0) + p.current;
    return acc;
  }, {});
  const topLocality = Object.entries(byLocality).sort((a, b) => b[1] - a[1])[0];
  const concentration = (topLocality[1] / totalValue) * 100;
  if (concentration > 60) {
    insights.push({
      icon: "💡",
      text: `${concentration.toFixed(0)}% of your portfolio is in ${topLocality[0]} — consider geographic diversification`,
      type: "neutral",
    });
  }

  // 5. All positive fallback
  if (insights.filter((i) => i.type !== "neutral").length === 0) {
    const allPositive = withGain.every((p) => p.gainPct >= 0);
    if (allPositive) {
      insights.push({
        icon: "✅",
        text: `All ${properties.length} properties are appreciating — solid portfolio performance`,
        type: "positive",
      });
    }
  }

  if (insights.length === 0) return null;

  const colorMap = {
    positive: "bg-[#d0e8da] dark:bg-[#1a3528] text-[#1a5c3a] dark:text-[#6fbc3a]",
    warning: "bg-[#fff8e1] dark:bg-[#2a1e00] text-[#92400e] dark:text-[#fbbf24]",
    neutral: "bg-[#e8eaf6] dark:bg-[#1a1d3a] text-[#3949ab] dark:text-[#7986cb]",
  };

  return (
    <div className="mt-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
        Portfolio Insights
      </p>
      <div className="flex flex-col gap-2">
        {insights.slice(0, 4).map((insight, i) => (
          <div
            key={i}
            className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium ${colorMap[insight.type]}`}
          >
            <span className="flex-shrink-0 text-base leading-5">{insight.icon}</span>
            <span className="leading-5">{insight.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
