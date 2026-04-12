"use client";

import { useState } from "react";
import { scoreAll, type LocalityScore } from "@/lib/scores";
import coordinates from "@/lib/data/locality_coordinates.json";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  IndianRupee,
  Brain,
  Home,
  Building2,
  Train,
  School,
  Hospital,
  ShoppingBag,
  Trees,
  Briefcase,
  Plane,
  ExternalLink,
} from "lucide-react";

const COORDS = coordinates as Record<string, { lat: number; lng: number }>;

function metroMapsUrl(stationName: string | undefined, locality: string): string {
  if (stationName) {
    return `https://www.google.com/maps/search/${encodeURIComponent(stationName + " Metro Station Bangalore")}`;
  }
  const coord = COORDS[locality];
  if (coord) {
    return `https://www.google.com/maps/search/metro+station/@${coord.lat},${coord.lng},15z`;
  }
  return `https://www.google.com/maps/search/namma+metro+station+${encodeURIComponent(locality)}+bangalore`;
}

const ALL_SCORES = scoreAll();

type SortKey = "score" | "momentum" | "yield" | "sentiment" | "affordability" | "infra";

const GRADE_STYLE: Record<string, string> = {
  "Strong Buy": "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  "Buy":        "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400",
  "Hold":       "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-500",
  "Watch":      "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

const COMPONENTS_META = [
  {
    key: "momentum",
    label: "Price Momentum",
    weight: "20%",
    color: "#2d8a58",
    icon: TrendingUp,
    description: "How fast prices have grown over the last 2 years (Q4 2023 → Q4 2025). A 15%+ annual CAGR scores 100. Captures whether a locality is in an active price run-up.",
    highMeans: "Prices rising strongly — neighbourhood likely gaining popularity or undergoing development",
    lowMeans: "Slower price growth — more stable but potentially missing a growth wave",
  },
  {
    key: "yield",
    label: "Rental Yield",
    weight: "20%",
    color: "#3b82f6",
    icon: IndianRupee,
    description: "Net rental yield on a 2BHK (gross yield × 0.75 to account for vacancy, maintenance & taxes). Normalised from 1% (score 0) to 4%+ (score 100). Measures income return on investment.",
    highMeans: "Strong rental income relative to property price — good for buy-to-let investors",
    lowMeans: "Low yield — appreciation play rather than rental income; common in premium localities",
  },
  {
    key: "sentiment",
    label: "Sentiment Signal",
    weight: "25%",
    color: "#a855f7",
    icon: Brain,
    description: "LLM-analysed development sentiment score (−0.15 to +0.15) plus a trend bonus (+20 for improving, −20 for declining). Updated weekly via our Supabase + HuggingFace pipeline. The single highest-weighted factor because sentiment leads price.",
    highMeans: "Positive development signals — metro lines, IT parks, infrastructure projects driving future demand",
    lowMeans: "Muted or declining sentiment — fewer positive catalysts recently flagged",
  },
  {
    key: "affordability",
    label: "Affordability",
    weight: "15%",
    color: "#f59e0b",
    icon: Home,
    description: "Entry-price attractiveness — how cheap the locality is vs Bangalore city avg (₹4,890/sqft). A locality priced at city avg scores 50; cheaper localities score higher. Rewards accessible entry points for first-time investors.",
    highMeans: "Priced below city average — lower capital requirement, higher upside potential",
    lowMeans: "Premium-priced locality — high barrier to entry, but often backed by established demand",
  },
  {
    key: "infra",
    label: "Infra Alpha",
    weight: "20%",
    color: "#ef4444",
    icon: Building2,
    description: "POI-based proximity scoring: metro station distance, hospital/school/mall density within 3km, office/IT park count. Falls back to keyword matching when POI data is unavailable. Hard infrastructure near a locality is the clearest forward-looking demand driver.",
    highMeans: "Metro nearby + strong amenity density — healthcare, education, employment all within reach",
    lowMeans: "Fewer nearby amenities or metro access — area may be developing or still car-dependent",
  },
];

// ─── Narrative generator ────────────────────────────────────────────────────
function generateNarrative(entry: LocalityScore): string {
  const { locality, score, grade, components, raw } = entry;

  const comps = [
    { name: "Price Momentum", key: "momentum", value: components.momentum },
    { name: "Rental Yield", key: "yield", value: components.yield },
    { name: "Sentiment", key: "sentiment", value: components.sentiment },
    { name: "Affordability", key: "affordability", value: components.affordability },
    { name: "Infra Alpha", key: "infra", value: components.infra },
  ].sort((a, b) => b.value - a.value);

  const top = comps[0];
  const second = comps[1];
  const bottom = comps[comps.length - 1];

  // Sentence 1: summary
  const gradeMap: Record<string, string> = {
    "Strong Buy": "a compelling investment case",
    "Buy": "a solid investment case",
    "Hold": "a moderate investment case",
    "Watch": "a cautious investment case",
  };
  const sentence1 = `${locality} scores ${score}/100, making ${gradeMap[grade]}.`;

  // Sentence 2: what's driving it
  const topContext = (() => {
    if (top.key === "momentum") return `strong price momentum (${raw.cagr_2y_pct.toFixed(1)}% annualised CAGR over 2 years)`;
    if (top.key === "yield") return `an attractive net rental yield of ${raw.net_yield_pct.toFixed(2)}%`;
    if (top.key === "sentiment") {
      const trendWord = raw.sentiment_trend === "up" ? "improving" : raw.sentiment_trend === "down" ? "weakening" : "stable";
      return `positive development sentiment (${trendWord} trend, LLM score ${(raw.sentiment_score * 100).toFixed(0)}/100)`;
    }
    if (top.key === "affordability") return `strong entry-price attractiveness at ₹${raw.price_per_sqft.toLocaleString("en-IN")}/sqft vs city avg ₹${raw.city_avg_psf.toLocaleString("en-IN")}`;
    return `${raw.infra_hits} active infrastructure signal${raw.infra_hits !== 1 ? "s" : ""} (metro, IT parks, highways)`;
  })();

  const secondContext = (() => {
    if (second.key === "momentum") return `price momentum`;
    if (second.key === "yield") return `rental yield`;
    if (second.key === "sentiment") return `sentiment signals`;
    if (second.key === "affordability") return `entry-price value`;
    return `infrastructure density`;
  })();

  const sentence2 = `It is primarily driven by ${topContext}, supported further by ${secondContext}.`;

  // Sentence 3: the drag
  const dragContext = (() => {
    if (bottom.key === "affordability") {
      return `affordability — at ₹${raw.price_per_sqft.toLocaleString("en-IN")}/sqft, it sits ${raw.price_per_sqft > raw.city_avg_psf ? "above" : "below"} the city average, raising the entry bar for investors`;
    }
    if (bottom.key === "yield") return `rental yield (${raw.net_yield_pct.toFixed(2)}%) — price appreciation here outpaces rental income`;
    if (bottom.key === "momentum") return `near-term price momentum — prices are growing but at a slower pace than the top-ranked localities`;
    if (bottom.key === "infra") return `infrastructure density — fewer active metro or highway projects currently flagged in this area`;
    return `sentiment signal — development activity in this locality is relatively quiet right now`;
  })();

  const sentence3 = bottom.value < 40
    ? `The main drag on the score is ${dragContext}.`
    : `No major weaknesses — all components score reasonably well.`;

  return `${sentence1} ${sentence2} ${sentence3}`;
}

// ─── Score pill ──────────────────────────────────────────────────────────────
function ScorePill({ score }: { score: number }) {
  const color =
    score >= 80 ? "bg-green-500"
    : score >= 65 ? "bg-teal-500"
    : score >= 50 ? "bg-amber-500"
    : "bg-red-500";
  return (
    <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold`}>
      {score}
    </div>
  );
}

// ─── Component bar ───────────────────────────────────────────────────────────
function ComponentBar({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground w-28 flex-shrink-0 leading-tight">{label}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
      <span className="font-semibold text-foreground w-7 text-right">{value}</span>
    </div>
  );
}

// ─── Methodology panel ───────────────────────────────────────────────────────
function MethodologyPanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-primary-highlight flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">How is this score calculated?</p>
            <p className="text-xs text-muted-foreground">5 data-driven components · click to expand</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-border space-y-5">
          {/* Weight bar */}
          <div className="mt-4">
            <p className="text-xs text-muted-foreground mb-2">Score composition (total = 100%)</p>
            <div className="flex rounded-full overflow-hidden h-4 text-[10px] font-bold text-white">
              {COMPONENTS_META.map((c) => (
                <div
                  key={c.key}
                  className="flex items-center justify-center overflow-hidden"
                  style={{ background: c.color, width: c.weight }}
                  title={`${c.label} — ${c.weight}`}
                >
                  {c.weight}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {COMPONENTS_META.map((c) => (
                <div key={c.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
                  {c.label}
                </div>
              ))}
            </div>
          </div>

          {/* Component cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {COMPONENTS_META.map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.key} className="bg-muted/40 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: c.color + "22" }}>
                      <Icon className="w-3.5 h-3.5" style={{ color: c.color }} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{c.label}</p>
                      <p className="text-[10px] text-muted-foreground">Weight: {c.weight}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{c.description}</p>
                  <div className="space-y-1">
                    <p className="text-[10px] text-green-600 dark:text-green-400">
                      <span className="font-semibold">High →</span> {c.highMeans}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      <span className="font-semibold">Low →</span> {c.lowMeans}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Grade thresholds */}
          <div>
            <p className="text-xs font-semibold text-foreground mb-2">Grade thresholds</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Strong Buy", range: "80–100", cls: GRADE_STYLE["Strong Buy"] },
                { label: "Buy", range: "65–79", cls: GRADE_STYLE["Buy"] },
                { label: "Hold", range: "50–64", cls: GRADE_STYLE["Hold"] },
                { label: "Watch", range: "< 50", cls: GRADE_STYLE["Watch"] },
              ].map((g) => (
                <div key={g.label} className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full ${g.cls}`}>
                  <span className="font-semibold">{g.label}</span>
                  <span className="opacity-70">{g.range}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Breakdown sheet ─────────────────────────────────────────────────────────
function ScoreBreakdownSheet({
  entry,
  open,
  onOpenChange,
}: {
  entry: LocalityScore | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  if (!entry) return null;

  const narrative = generateNarrative(entry);

  const radarData = [
    { axis: "Momentum", value: entry.components.momentum },
    { axis: "Yield", value: entry.components.yield },
    { axis: "Sentiment", value: entry.components.sentiment },
    { axis: "Affordability", value: entry.components.affordability },
    { axis: "Infra", value: entry.components.infra },
  ];

  const TrendIcon = entry.raw.sentiment_trend === "up" ? TrendingUp
    : entry.raw.sentiment_trend === "down" ? TrendingDown : Minus;
  const trendColor = entry.raw.sentiment_trend === "up" ? "text-green-500"
    : entry.raw.sentiment_trend === "down" ? "text-red-500" : "text-muted-foreground";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:w-[420px] bg-surface border-border overflow-y-auto"
      >
        <SheetHeader className="mb-5">
          <SheetTitle className="font-display text-left">{entry.locality}</SheetTitle>
        </SheetHeader>

        <div className="space-y-5">
          {/* Score hero */}
          <div className="flex items-center gap-4 bg-muted rounded-xl p-4">
            <div
              className={`w-16 h-16 rounded-full flex-shrink-0 flex items-center justify-center text-2xl font-bold text-white ${
                entry.score >= 80 ? "bg-green-500"
                : entry.score >= 65 ? "bg-teal-500"
                : entry.score >= 50 ? "bg-amber-500"
                : "bg-red-500"
              }`}
            >
              {entry.score}
            </div>
            <div>
              <span className={`text-sm font-semibold px-3 py-1 rounded-full ${GRADE_STYLE[entry.grade]}`}>
                {entry.grade}
              </span>
              <p className="text-xs text-muted-foreground mt-1.5">PropIQ Investment Score</p>
              <p className="text-xs text-muted-foreground">Updated Q4 2025</p>
            </div>
          </div>

          {/* Natural language narrative */}
          <div className="bg-primary-highlight dark:bg-[#1a3528] rounded-xl p-4">
            <p className="text-xs font-semibold text-primary mb-2">Why this score?</p>
            <p className="text-sm text-foreground leading-relaxed">{narrative}</p>
          </div>

          {/* Key raw stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-muted rounded-lg p-2.5">
              <p className="text-[10px] text-muted-foreground mb-0.5">2Y Price CAGR</p>
              <p className="text-sm font-bold text-foreground">{entry.raw.cagr_2y_pct.toFixed(1)}%/yr</p>
            </div>
            <div className="bg-muted rounded-lg p-2.5">
              <p className="text-[10px] text-muted-foreground mb-0.5">Net Rental Yield</p>
              <p className="text-sm font-bold text-foreground">{entry.raw.net_yield_pct.toFixed(2)}%</p>
            </div>
            <div className="bg-muted rounded-lg p-2.5">
              <p className="text-[10px] text-muted-foreground mb-0.5">Current ₹/sqft</p>
              <p className="text-sm font-bold text-foreground">₹{entry.raw.price_per_sqft.toLocaleString("en-IN")}</p>
            </div>
            <div className="bg-muted rounded-lg p-2.5">
              <p className="text-[10px] text-muted-foreground mb-0.5">Sentiment Trend</p>
              <p className="text-sm font-bold flex items-center gap-1">
                <TrendIcon className={`w-4 h-4 ${trendColor}`} />
                <span className={trendColor}>
                  {entry.raw.sentiment_trend === "up" ? "Improving"
                    : entry.raw.sentiment_trend === "down" ? "Declining" : "Stable"}
                </span>
              </p>
            </div>
          </div>

          {/* Radar chart */}
          <div>
            <p className="text-sm font-semibold text-foreground mb-1">Component Radar</p>
            <p className="text-xs text-muted-foreground mb-2">Each axis = 0–100. A perfect circle = 100 on all components.</p>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData} margin={{ top: 8, right: 24, left: 24, bottom: 8 }}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis
                  dataKey="axis"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <Tooltip
                  formatter={(v) => [v, "Score"]}
                  contentStyle={{
                    fontSize: 11,
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                  }}
                />
                <Radar
                  dataKey="value"
                  stroke="#2d8a58"
                  fill="#2d8a58"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Component bars with context */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">Score Breakdown</p>
            {COMPONENTS_META.map((meta) => {
              const val = entry.components[meta.key as keyof typeof entry.components];
              return (
                <div key={meta.key}>
                  <ComponentBar value={val} label={`${meta.label} (${meta.weight})`} color={meta.color} />
                </div>
              );
            })}
          </div>

          {/* What's Nearby — POI card */}
          {entry.raw.poi && (
            <div className="bg-muted/40 rounded-xl p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground">What&apos;s Nearby</p>
                <span className="text-[10px] text-muted-foreground">within 3km radius</span>
              </div>

              {/* Metro distance — prominent */}
              <a
                href={metroMapsUrl(entry.raw.poi.nearest_metro_name, entry.locality)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg group transition-opacity hover:opacity-80 ${
                  entry.raw.poi.metro_distance_m <= 500 ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800"
                  : entry.raw.poi.metro_distance_m <= 1500 ? "bg-primary/5 border border-primary/20"
                  : entry.raw.poi.metro_distance_m <= 3000 ? "bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800"
                  : "bg-muted border border-border"
                }`}
              >
                <Train className={`w-4 h-4 flex-shrink-0 ${
                  entry.raw.poi.metro_distance_m <= 500 ? "text-green-600"
                  : entry.raw.poi.metro_distance_m <= 1500 ? "text-primary"
                  : entry.raw.poi.metro_distance_m <= 3000 ? "text-amber-500"
                  : "text-muted-foreground"
                }`} />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-foreground">
                    {entry.raw.poi.nearest_metro_name ?? "Namma Metro"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {entry.raw.poi.metro_distance_m >= 9000
                      ? "No metro nearby · tap to search"
                      : entry.raw.poi.metro_distance_m >= 1000
                      ? `${(entry.raw.poi.metro_distance_m / 1000).toFixed(1)}km away · tap for directions`
                      : `${entry.raw.poi.metro_distance_m}m away · tap for directions`}
                  </p>
                </div>
                <ExternalLink className="w-3 h-3 text-muted-foreground opacity-60 group-hover:opacity-100 flex-shrink-0" />
              </a>

              {/* POI grid */}
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { icon: School,      label: "Schools",   value: entry.raw.poi.schools   },
                  { icon: Hospital,    label: "Hospitals", value: entry.raw.poi.hospitals  },
                  { icon: ShoppingBag, label: "Malls",     value: entry.raw.poi.malls      },
                  { icon: Trees,       label: "Parks",     value: entry.raw.poi.parks      },
                  { icon: Briefcase,   label: "Offices",   value: entry.raw.poi.offices    },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-2 bg-background rounded-lg px-2.5 py-2">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">{value}</p>
                      <p className="text-[10px] text-muted-foreground leading-none">{label}</p>
                    </div>
                  </div>
                ))}

                {/* Special infra tags */}
                {entry.raw.poi.special_infra.length > 0 && (
                  <div className="flex items-center gap-2 bg-background rounded-lg px-2.5 py-2">
                    <Plane className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-foreground capitalize">
                        {entry.raw.poi.special_infra[0].replace(/_/g, " ")}
                      </p>
                      <p className="text-[10px] text-muted-foreground leading-none">Special infra</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sentiment highlights */}
          {entry.raw.highlights.length > 0 && (
            <div className="bg-muted/40 rounded-xl p-3 space-y-1.5">
              <p className="text-xs font-semibold text-foreground">Development Signals</p>
              <p className="text-[10px] text-muted-foreground mb-2">
                {entry.raw.infra_hits} infrastructure keyword{entry.raw.infra_hits !== 1 ? "s" : ""} detected
              </p>
              {entry.raw.highlights.map((h, i) => (
                <p key={i} className="text-xs text-muted-foreground flex gap-1.5">
                  <span className="text-primary mt-0.5 flex-shrink-0">·</span>
                  {h}
                </p>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function ScoresPage() {
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<LocalityScore | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const sorted = [...ALL_SCORES].sort((a, b) => {
    const va = sortKey === "score" ? a.score : a.components[sortKey as keyof typeof a.components];
    const vb = sortKey === "score" ? b.score : b.components[sortKey as keyof typeof b.components];
    return sortAsc ? va - vb : vb - va;
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(false); }
  };

  function SortBtn({ label, k }: { label: string; k: SortKey }) {
    return (
      <button
        onClick={() => handleSort(k)}
        className={`flex items-center gap-1 text-xs font-medium ${
          sortKey === k ? "text-primary" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {label}
        <ArrowUpDown className="w-3 h-3" />
      </button>
    );
  }

  const handleRowClick = (entry: LocalityScore) => {
    setSelectedEntry(entry);
    setSheetOpen(true);
  };

  const strongBuys = ALL_SCORES.filter((s) => s.grade === "Strong Buy").length;
  const buys = ALL_SCORES.filter((s) => s.grade === "Buy").length;

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">
          PropIQ Investment Score
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Composite 0–100 investability score for every Bangalore locality — Q4 2025
        </p>
      </div>

      {/* Methodology panel */}
      <MethodologyPanel />

      {/* Summary pills */}
      <div className="flex flex-wrap gap-3">
        <div className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-4 py-2 rounded-full text-sm font-semibold">
          {strongBuys} Strong Buy
        </div>
        <div className="bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 px-4 py-2 rounded-full text-sm font-semibold">
          {buys} Buy
        </div>
        <div className="bg-surface border border-border px-4 py-2 rounded-full text-sm text-muted-foreground">
          {ALL_SCORES.length} localities scored · click any row for full breakdown
        </div>
      </div>

      {/* Sort controls */}
      <div className="flex gap-4 flex-wrap text-xs">
        <span className="text-muted-foreground self-center">Sort by:</span>
        <SortBtn label="Total Score" k="score" />
        <SortBtn label="Momentum" k="momentum" />
        <SortBtn label="Yield" k="yield" />
        <SortBtn label="Sentiment" k="sentiment" />
        <SortBtn label="Affordability" k="affordability" />
        <SortBtn label="Infra" k="infra" />
      </div>

      {/* Leaderboard */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">#</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">Locality</th>
                <th className="text-center py-3 px-4 text-xs font-medium text-muted-foreground">Score</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">Grade</th>
                <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground" title="2Y price CAGR normalised (20%)">Momentum</th>
                <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground" title="Net rental yield normalised (20%)">Yield</th>
                <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground" title="LLM sentiment score + trend (25%)">Sentiment</th>
                <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground" title="Entry price vs city avg (15%)">Afford.</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground" title="Infrastructure keyword density (20%)">Infra</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((entry, idx) => (
                <tr
                  key={entry.locality}
                  onClick={() => handleRowClick(entry)}
                  className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <td className="py-3 px-4 text-xs text-muted-foreground">{idx + 1}</td>
                  <td className="py-3 px-4 font-semibold text-foreground whitespace-nowrap">
                    {entry.locality}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex justify-center">
                      <ScorePill score={entry.score} />
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${GRADE_STYLE[entry.grade]}`}>
                      {entry.grade}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right text-xs text-muted-foreground">{entry.components.momentum}</td>
                  <td className="py-3 px-3 text-right text-xs text-muted-foreground">{entry.components.yield}</td>
                  <td className="py-3 px-3 text-right text-xs text-muted-foreground">{entry.components.sentiment}</td>
                  <td className="py-3 px-3 text-right text-xs text-muted-foreground">{entry.components.affordability}</td>
                  <td className="py-3 px-4 text-right text-xs text-muted-foreground">{entry.components.infra}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Scores are algorithmic and updated quarterly. For informational purposes only — not financial advice.
      </p>

      <ScoreBreakdownSheet
        entry={selectedEntry}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}
