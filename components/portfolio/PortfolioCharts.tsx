"use client";

import { Property } from "@/lib/portfolio";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import { formatLakhs, formatLakhsShort } from "@/lib/utils/format";

const COLORS = ["#1a5c3a", "#2d8a58", "#4caf82", "#7dcca8", "#a8d5b5", "#c5e8d4"];

interface PortfolioChartsProps {
  properties: Property[];
}

export function PortfolioCharts({ properties }: PortfolioChartsProps) {
  if (properties.length < 2) return null;

  // Donut data
  const donutData = properties.map((p) => ({
    name: p.name,
    value: p.ai_estimated_value_lakhs ?? p.purchase_price_lakhs,
  }));
  const totalValue = donutData.reduce((s, d) => s + d.value, 0);

  // Bar chart data — sorted by gain %
  const barData = [...properties]
    .map((p) => {
      const current = p.ai_estimated_value_lakhs ?? p.purchase_price_lakhs;
      const gainPct =
        p.purchase_price_lakhs > 0
          ? ((current - p.purchase_price_lakhs) / p.purchase_price_lakhs) * 100
          : 0;
      return {
        name: p.name.length > 14 ? p.name.slice(0, 13) + "…" : p.name,
        fullName: p.name,
        gainPct: Math.round(gainPct * 10) / 10,
        purchased: p.purchase_price_lakhs,
        current,
      };
    })
    .sort((a, b) => b.gainPct - a.gainPct);

  return (
    <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Donut chart */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <p className="text-sm font-semibold text-foreground mb-4">Portfolio Allocation</p>
        <div className="relative h-52">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={donutData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={85}
                paddingAngle={2}
                dataKey="value"
              >
                {donutData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any, _: any, props: any) => [
                  `${formatLakhs(Number(value))} (${((Number(value) / totalValue) * 100).toFixed(1)}%)`,
                  props.payload?.name ?? "",
                ]}
                contentStyle={{
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-xs text-muted-foreground">Total Value</p>
            <p className="font-display font-bold text-lg text-foreground">
              {formatLakhsShort(totalValue)}
            </p>
          </div>
        </div>
        {/* Legend */}
        <div className="mt-3 flex flex-col gap-1">
          {donutData.map((d, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: COLORS[i % COLORS.length] }}
                />
                <span className="text-muted-foreground truncate max-w-[140px]">{d.name}</span>
              </div>
              <span className="text-foreground font-medium">
                {((d.value / totalValue) * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Gain % bar chart */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <p className="text-sm font-semibold text-foreground mb-4">Gain / Loss by Property</p>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: "var(--color-muted-fg)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--color-muted-fg)" }}
                tickFormatter={(v) => `${v}%`}
                axisLine={false}
                tickLine={false}
                width={36}
              />
              <ReferenceLine y={0} stroke="var(--color-border)" strokeWidth={1.5} />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any, _: any, props: any) => {
                  const p = props.payload as typeof barData[0] | undefined;
                  const v = Number(value);
                  if (!p) return [`${v}%`, "Gain"];
                  return [
                    `${v >= 0 ? "+" : ""}${v}%\nBought: ${formatLakhs(p.purchased)}\nNow: ${formatLakhs(p.current)}`,
                    p.fullName,
                  ];
                }}
                contentStyle={{
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                  whiteSpace: "pre-line",
                }}
              />
              <Bar dataKey="gainPct" radius={[4, 4, 0, 0]}>
                {barData.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.gainPct >= 0 ? "#1a5c3a" : "#a13544"}
                    opacity={0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
