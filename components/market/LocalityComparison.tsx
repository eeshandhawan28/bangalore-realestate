"use client";

import { useState } from "react";
import {
  LineChart, Line, ResponsiveContainer, Tooltip, YAxis,
} from "recharts";
import marketStats from "@/lib/data/market_stats.json";
import rentalYields from "@/lib/data/locality_rental_yields.json";
import priceHistory from "@/lib/data/locality_price_history.json";
import sentimentData from "@/lib/data/locality_sentiment.json";
import { formatLakhs, formatPricePerSqft, formatPercent } from "@/lib/utils/format";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

const HISTORY = priceHistory.localities as Record<string, number[]>;
const PERIODS = priceHistory.periods;
const YIELDS = rentalYields as Record<string, {
  rent_2bhk: number;
  gross_yield_2bhk_pct: number;
  net_yield_pct: number;
  appreciation_5y_pct: number;
  appreciation_1y_pct: number;
  rental_demand: string;
}>;
const SENTIMENT = sentimentData as Record<string, {
  sentiment_score: number;
  trend: "up" | "stable" | "down";
  highlights: string[];
}>;

const ALL_LOCALITY_NAMES = Object.keys(HISTORY).sort();

const MARKET_MAP = Object.fromEntries(
  marketStats.localities.map((l) => [l.name, l])
);

// 3Y range: index 6 → 12
const SPARK_START = 6;

function getLocalityData(name: string) {
  const market = MARKET_MAP[name];
  const yld = YIELDS[name];
  const hist = HISTORY[name];
  const sent = SENTIMENT[name];
  return { market, yld, hist, sent };
}

type WinnerSide = "a" | "b" | "tie";

function winner(valA: number, valB: number, higherIsBetter = true): WinnerSide {
  if (Math.abs(valA - valB) < 0.001) return "tie";
  if (higherIsBetter) return valA > valB ? "a" : "b";
  return valA < valB ? "a" : "b";
}

function CellValue({
  value,
  isWinner,
}: {
  value: React.ReactNode;
  isWinner: boolean;
}) {
  return (
    <td
      className={`py-3 px-4 text-sm text-right ${
        isWinner
          ? "font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/10"
          : "text-foreground"
      }`}
    >
      {value}
    </td>
  );
}

function DemandBadge({ demand }: { demand: string }) {
  const cls =
    demand === "High"
      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
      : demand === "Medium"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-500"
      : "bg-muted text-muted-foreground";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>
      {demand}
    </span>
  );
}

function SentimentIcon({ trend }: { trend: "up" | "stable" | "down" }) {
  if (trend === "up") return <TrendingUp className="w-4 h-4 text-green-500 inline mr-1" />;
  if (trend === "down") return <TrendingDown className="w-4 h-4 text-red-500 inline mr-1" />;
  return <Minus className="w-4 h-4 text-muted-foreground inline mr-1" />;
}

function Sparkline({ locality }: { locality: string }) {
  const hist = HISTORY[locality];
  if (!hist) return null;
  const data = hist.slice(SPARK_START).map((v, i) => ({
    p: PERIODS[SPARK_START + i],
    v,
  }));
  return (
    <ResponsiveContainer width="100%" height={60}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <YAxis domain={["auto", "auto"]} hide />
        <Tooltip
          formatter={(v) => [`₹${Number(v).toLocaleString("en-IN")}/sqft`, "Price"]}
          labelFormatter={(l) => l}
          contentStyle={{
            fontSize: 10,
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--surface)",
          }}
        />
        <Line
          type="monotone"
          dataKey="v"
          stroke="#2d8a58"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function LocalityComparison() {
  const [locA, setLocA] = useState("Koramangala");
  const [locB, setLocB] = useState("Whitefield");

  const a = getLocalityData(locA);
  const b = getLocalityData(locB);

  const avgPsfA = a.hist?.[a.hist.length - 1] ?? 0;
  const avgPsfB = b.hist?.[b.hist.length - 1] ?? 0;
  const sentScoreA = a.sent?.sentiment_score ?? 0;
  const sentScoreB = b.sent?.sentiment_score ?? 0;

  const rows: {
    label: string;
    renderA: () => React.ReactNode;
    renderB: () => React.ReactNode;
    winnerFn?: () => WinnerSide;
  }[] = [
    {
      label: "Avg ₹/sqft",
      renderA: () => formatPricePerSqft(avgPsfA),
      renderB: () => formatPricePerSqft(avgPsfB),
      winnerFn: () => winner(avgPsfA, avgPsfB, false),
    },
    {
      label: "2BHK Median",
      renderA: () => a.market ? formatLakhs(a.market.median_2bhk_lakhs) : "—",
      renderB: () => b.market ? formatLakhs(b.market.median_2bhk_lakhs) : "—",
      winnerFn: () => a.market && b.market ? winner(a.market.median_2bhk_lakhs, b.market.median_2bhk_lakhs, false) : "tie",
    },
    {
      label: "3BHK Median",
      renderA: () => a.market ? formatLakhs(a.market.median_3bhk_lakhs) : "—",
      renderB: () => b.market ? formatLakhs(b.market.median_3bhk_lakhs) : "—",
      winnerFn: () => a.market && b.market ? winner(a.market.median_3bhk_lakhs, b.market.median_3bhk_lakhs, false) : "tie",
    },
    {
      label: "Gross Yield",
      renderA: () => a.yld ? `${a.yld.gross_yield_2bhk_pct.toFixed(2)}%` : "—",
      renderB: () => b.yld ? `${b.yld.gross_yield_2bhk_pct.toFixed(2)}%` : "—",
      winnerFn: () => a.yld && b.yld ? winner(a.yld.gross_yield_2bhk_pct, b.yld.gross_yield_2bhk_pct) : "tie",
    },
    {
      label: "Net Yield",
      renderA: () => a.yld ? `${a.yld.net_yield_pct.toFixed(2)}%` : "—",
      renderB: () => b.yld ? `${b.yld.net_yield_pct.toFixed(2)}%` : "—",
      winnerFn: () => a.yld && b.yld ? winner(a.yld.net_yield_pct, b.yld.net_yield_pct) : "tie",
    },
    {
      label: "5Y Appreciation",
      renderA: () => a.yld ? formatPercent(a.yld.appreciation_5y_pct) : "—",
      renderB: () => b.yld ? formatPercent(b.yld.appreciation_5y_pct) : "—",
      winnerFn: () => a.yld && b.yld ? winner(a.yld.appreciation_5y_pct, b.yld.appreciation_5y_pct) : "tie",
    },
    {
      label: "1Y Appreciation",
      renderA: () => a.yld ? formatPercent(a.yld.appreciation_1y_pct) : "—",
      renderB: () => b.yld ? formatPercent(b.yld.appreciation_1y_pct) : "—",
      winnerFn: () => a.yld && b.yld ? winner(a.yld.appreciation_1y_pct, b.yld.appreciation_1y_pct) : "tie",
    },
    {
      label: "2BHK Rent/mo",
      renderA: () => a.yld ? `₹${a.yld.rent_2bhk.toLocaleString("en-IN")}` : "—",
      renderB: () => b.yld ? `₹${b.yld.rent_2bhk.toLocaleString("en-IN")}` : "—",
      winnerFn: () => a.yld && b.yld ? winner(a.yld.rent_2bhk, b.yld.rent_2bhk) : "tie",
    },
    {
      label: "Rental Demand",
      renderA: () => a.yld ? <DemandBadge demand={a.yld.rental_demand} /> : "—",
      renderB: () => b.yld ? <DemandBadge demand={b.yld.rental_demand} /> : "—",
    },
    {
      label: "Sentiment",
      renderA: () => a.sent ? (
        <span className="flex items-center justify-end gap-1">
          <SentimentIcon trend={a.sent.trend} />
          {(sentScoreA * 100).toFixed(0)}/100
        </span>
      ) : "—",
      renderB: () => b.sent ? (
        <span className="flex items-center justify-end gap-1">
          <SentimentIcon trend={b.sent.trend} />
          {(sentScoreB * 100).toFixed(0)}/100
        </span>
      ) : "—",
      winnerFn: () => winner(sentScoreA, sentScoreB),
    },
  ];

  const selectClass =
    "w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="space-y-6">
      {/* Locality pickers */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Locality A</label>
          <select value={locA} onChange={(e) => setLocA(e.target.value)} className={selectClass}>
            {ALL_LOCALITY_NAMES.map((n) => (
              <option key={n} value={n} disabled={n === locB}>{n}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Locality B</label>
          <select value={locB} onChange={(e) => setLocB(e.target.value)} className={selectClass}>
            {ALL_LOCALITY_NAMES.map((n) => (
              <option key={n} value={n} disabled={n === locA}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Comparison table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground w-[160px]">Metric</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-primary">{locA}</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-foreground">{locB}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ label, renderA, renderB, winnerFn }) => {
              const w = winnerFn ? winnerFn() : "tie";
              return (
                <tr key={label} className="border-b border-border/50">
                  <td className="py-3 px-4 text-xs text-muted-foreground font-medium">{label}</td>
                  <CellValue value={renderA()} isWinner={w === "a"} />
                  <CellValue value={renderB()} isWinner={w === "b"} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Dual sparklines */}
      <div className="grid grid-cols-2 gap-4">
        {[{ name: locA, isPrimary: true }, { name: locB, isPrimary: false }].map(({ name, isPrimary }) => (
          <div key={name} className="bg-muted/30 rounded-xl p-3">
            <p className={`text-xs font-semibold mb-2 ${isPrimary ? "text-primary" : "text-foreground"}`}>
              {name} — Price Trend (3Y)
            </p>
            <Sparkline locality={name} />
          </div>
        ))}
      </div>

      {/* Sentiment highlights */}
      <div className="grid grid-cols-2 gap-4">
        {[locA, locB].map((name) => {
          const sent = SENTIMENT[name];
          return sent ? (
            <div key={name} className="bg-muted/20 rounded-xl p-3 space-y-1.5">
              <p className="text-xs font-semibold text-foreground">{name} — Highlights</p>
              {sent.highlights.map((h, i) => (
                <p key={i} className="text-xs text-muted-foreground flex gap-1.5">
                  <span className="text-primary mt-0.5">·</span>
                  {h}
                </p>
              ))}
            </div>
          ) : null;
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Green = better value for that metric. Price data: Q4 2019–Q4 2025. Yields: Q4 2024 actuals.
      </p>
    </div>
  );
}
