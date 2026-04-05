"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";

interface LocalityData {
  name: string;
  avg_price_per_sqft: number;
}

interface PriceDistributionChartProps {
  localities: LocalityData[];
  selectedLocality: string | null;
}

export function PriceDistributionChart({
  localities,
  selectedLocality,
}: PriceDistributionChartProps) {
  // Show top 15 by avg_price_per_sqft
  const data = [...localities]
    .sort((a, b) => b.avg_price_per_sqft - a.avg_price_per_sqft)
    .slice(0, 15)
    .map((l) => ({
      name: l.name.length > 12 ? l.name.slice(0, 12) + "…" : l.name,
      fullName: l.name,
      value: l.avg_price_per_sqft,
    }));

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">
        Top 15 Localities by Avg ₹/sqft
      </p>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 4, right: 8, left: 4, bottom: 60 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-border)"
              vertical={false}
            />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: "var(--color-muted-fg)" }}
              angle={-45}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--color-muted-fg)" }}
              tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
              width={40}
            />
            <Tooltip
              formatter={(value, _name, props) => [
                `₹${Number(value).toLocaleString("en-IN")}/sqft`,
                (props.payload as { fullName?: string })?.fullName ?? "Locality",
              ]}
              contentStyle={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((entry) => (
                <Cell
                  key={entry.fullName}
                  fill={
                    entry.fullName === selectedLocality
                      ? "var(--color-primary)"
                      : "var(--color-primary-highlight)"
                  }
                  stroke={
                    entry.fullName === selectedLocality
                      ? "var(--color-primary)"
                      : "none"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Click a row in the table to highlight a locality
      </p>
    </div>
  );
}
