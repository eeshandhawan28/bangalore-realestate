"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import priceHistory from "@/lib/data/locality_price_history.json";

const ALL_LOCALITIES = Object.keys(priceHistory.localities);
const PERIODS = priceHistory.periods;
const DATA = priceHistory.localities as Record<string, number[]>;

// Range → starting index in the 11-point series
const RANGE_START: Record<string, number> = { "1Y": 8, "3Y": 4, "5Y": 0 };

const COLORS = [
  "#2d8a58", "#3b82f6", "#f59e0b", "#a855f7",
  "#ef4444", "#06b6d4", "#ec4899",
];

const DEFAULT_SELECTED = ["Koramangala", "HSR Layout", "Whitefield", "Devanahalli", "Electronic City"];

// Custom tooltip
function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { color: string; name: string; value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold text-foreground mb-1.5">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 mb-0.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="font-medium text-foreground ml-auto pl-4">
            ₹{p.value.toLocaleString("en-IN")}/sqft
          </span>
        </div>
      ))}
    </div>
  );
}

export function AppreciationTrendsChart() {
  const [range, setRange] = useState<"1Y" | "3Y" | "5Y">("3Y");
  const [selected, setSelected] = useState<string[]>(DEFAULT_SELECTED);

  const startIdx = RANGE_START[range];
  const visiblePeriods = PERIODS.slice(startIdx);

  const chartData = visiblePeriods.map((period, i) => {
    const entry: Record<string, string | number> = { period };
    selected.forEach((loc) => {
      entry[loc] = DATA[loc]?.[startIdx + i] ?? 0;
    });
    return entry;
  });

  // Appreciation % for each selected locality in the current range
  const appreciationStats = selected.map((loc) => {
    const values = DATA[loc];
    if (!values) return { loc, pct: 0 };
    const start = values[startIdx];
    const end = values[10];
    const pct = ((end - start) / start) * 100;
    return { loc, pct };
  });

  const toggleLocality = (loc: string) => {
    setSelected((prev) =>
      prev.includes(loc)
        ? prev.length > 1 ? prev.filter((l) => l !== loc) : prev
        : prev.length < 7 ? [...prev, loc] : prev
    );
  };

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display font-semibold text-foreground">
            Price Appreciation Trends
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            ₹/sqft over time — select up to 7 localities to compare
          </p>
        </div>
        {/* Time range toggle */}
        <div className="flex border border-border rounded-lg overflow-hidden text-xs font-medium">
          {(["1Y", "3Y", "5Y"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-4 py-1.5 transition-colors ${
                range === r
                  ? "bg-primary text-white"
                  : "bg-surface text-muted-foreground hover:text-foreground"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Appreciation badges */}
      <div className="flex flex-wrap gap-2">
        {appreciationStats.map(({ loc, pct }, i) => (
          <div
            key={loc}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-border bg-surface"
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: COLORS[i % COLORS.length] }}
            />
            <span className="text-foreground font-medium">{loc}</span>
            <span
              className={`font-semibold ${pct >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}
            >
              +{pct.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="period"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
            width={40}
          />
          <Tooltip content={<ChartTooltip />} />
          {selected.map((loc, i) => (
            <Line
              key={loc}
              type="monotone"
              dataKey={loc}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Locality selector */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Toggle localities ({selected.length}/7 selected)</p>
        <div className="flex flex-wrap gap-2">
          {ALL_LOCALITIES.map((loc, i) => {
            const isOn = selected.includes(loc);
            const color = COLORS[selected.indexOf(loc) % COLORS.length];
            return (
              <button
                key={loc}
                onClick={() => toggleLocality(loc)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                  isOn
                    ? "border-transparent text-white"
                    : "border-border bg-surface text-muted-foreground hover:text-foreground"
                }`}
                style={isOn ? { background: color, borderColor: color } : {}}
              >
                {loc}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
