"use client";

import { useState, useMemo } from "react";
import marketStats from "@/lib/data/market_stats.json";
import rentalYields from "@/lib/data/locality_rental_yields.json";
import { formatLakhs, formatPricePerSqft } from "@/lib/utils/format";
import { MapPin, IndianRupee, TrendingUp } from "lucide-react";

const YIELDS = rentalYields as Record<string, { net_yield_pct: number; rental_demand: string }>;

type Locality = (typeof marketStats.localities)[number];

interface AffordabilityCalculatorProps {
  localities: Locality[];
  onLocalityClick: (locality: Locality) => void;
}

const TENURE_OPTIONS = [10, 15, 20, 25] as const;

function calcMaxLoan(
  salary: number,
  existingEmi: number,
  downPct: number,
  tenureYears: number,
  ratePercent: number
): { maxEmi: number; maxLoan: number; maxBudget: number } {
  const maxEmi = salary * 0.5 - existingEmi;
  if (maxEmi <= 0) return { maxEmi: 0, maxLoan: 0, maxBudget: 0 };
  const monthlyRate = ratePercent / 12 / 100;
  const n = tenureYears * 12;
  const maxLoan =
    monthlyRate > 0
      ? (maxEmi * (1 - Math.pow(1 + monthlyRate, -n))) / monthlyRate
      : maxEmi * n;
  const maxBudget = maxLoan / (1 - downPct / 100);
  return { maxEmi, maxLoan, maxBudget };
}

export function AffordabilityCalculator({
  localities,
  onLocalityClick,
}: AffordabilityCalculatorProps) {
  const [salary, setSalary] = useState("");
  const [existingEmi, setExistingEmi] = useState("");
  const [downPct, setDownPct] = useState(20);
  const [tenure, setTenure] = useState<10 | 15 | 20 | 25>(20);
  const [rate, setRate] = useState("8.5");

  const salaryNum = parseFloat(salary) || 0;
  const existingEmiNum = parseFloat(existingEmi) || 0;
  const rateNum = parseFloat(rate) || 8.5;

  const { maxEmi, maxLoan, maxBudget } = useMemo(
    () => calcMaxLoan(salaryNum, existingEmiNum, downPct, tenure, rateNum),
    [salaryNum, existingEmiNum, downPct, tenure, rateNum]
  );

  const maxBudgetLakhs = maxBudget / 100000;

  const affordableLocalities = useMemo(() => {
    if (maxBudgetLakhs <= 0) return [];
    return localities
      .filter((l) => l.median_2bhk_lakhs <= maxBudgetLakhs)
      .sort((a, b) => {
        const yA = YIELDS[a.name]?.net_yield_pct ?? 0;
        const yB = YIELDS[b.name]?.net_yield_pct ?? 0;
        return yB - yA;
      })
      .slice(0, 6);
  }, [localities, maxBudgetLakhs]);

  const hasResult = salaryNum > 0;

  const inputClass =
    "w-full h-9 px-3 rounded-lg border border-border bg-surface text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-semibold text-foreground">EMI & Affordability Calculator</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Based on standard 50% FOIR (Fixed Obligation-to-Income Ratio) used by Indian banks
        </p>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Monthly Gross Salary (₹)
          </label>
          <input
            type="number"
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
            placeholder="e.g. 150000"
            className={inputClass}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Existing Monthly EMIs (₹)
          </label>
          <input
            type="number"
            value={existingEmi}
            onChange={(e) => setExistingEmi(e.target.value)}
            placeholder="e.g. 15000"
            className={inputClass}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Interest Rate (%)
          </label>
          <input
            type="number"
            step="0.1"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Down Payment — {downPct}%
          </label>
          <input
            type="range"
            min={10}
            max={40}
            step={5}
            value={downPct}
            onChange={(e) => setDownPct(Number(e.target.value))}
            className="w-full accent-primary h-1.5 rounded-full cursor-pointer mt-2"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>10%</span><span>40%</span>
          </div>
        </div>
      </div>

      {/* Tenure toggle */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-2 block">Loan Tenure</label>
        <div className="flex gap-2">
          {TENURE_OPTIONS.map((t) => (
            <button
              key={t}
              onClick={() => setTenure(t)}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tenure === t ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}Y
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {hasResult && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-primary-highlight dark:bg-[#1a3528] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <IndianRupee className="w-4 h-4 text-primary" />
                <p className="text-xs text-muted-foreground font-medium">Max Home Loan</p>
              </div>
              <p className="font-display text-xl font-bold text-primary">
                {formatLakhs(maxLoan / 100000)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Max EMI: ₹{Math.round(maxEmi).toLocaleString("en-IN")}/mo
              </p>
            </div>
            <div className="bg-muted rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-foreground" />
                <p className="text-xs text-muted-foreground font-medium">Suggested Budget</p>
              </div>
              <p className="font-display text-xl font-bold text-foreground">
                {formatLakhs(maxBudgetLakhs)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Loan + {downPct}% down payment
              </p>
            </div>
            <div className="bg-muted rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-foreground" />
                <p className="text-xs text-muted-foreground font-medium">Affordable 2BHKs</p>
              </div>
              <p className="font-display text-xl font-bold text-foreground">
                {affordableLocalities.length}
              </p>
              <p className="text-xs text-muted-foreground mt-1">localities within budget</p>
            </div>
          </div>

          {affordableLocalities.length > 0 ? (
            <div>
              <p className="text-sm font-semibold text-foreground mb-3">
                Best 2BHK localities within {formatLakhs(maxBudgetLakhs)}
                <span className="text-xs text-muted-foreground font-normal ml-2">
                  sorted by rental yield
                </span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {affordableLocalities.map((l) => {
                  const yld = YIELDS[l.name];
                  return (
                    <button
                      key={l.name}
                      onClick={() => onLocalityClick(l)}
                      className="text-left bg-surface border border-border rounded-xl p-3 hover:border-primary/40 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <p className="text-sm font-semibold text-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-primary flex-shrink-0" />
                          {l.name}
                        </p>
                        {yld && (
                          <span className="text-xs font-bold text-primary ml-2">
                            {yld.net_yield_pct.toFixed(2)}% net
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-bold text-green-600 dark:text-green-400">
                        {formatLakhs(l.median_2bhk_lakhs)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatPricePerSqft(l.avg_price_per_sqft)}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : maxBudgetLakhs > 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No 2BHK localities within this budget. Consider a higher down payment or longer tenure.
            </p>
          ) : null}
        </>
      )}

      {!hasResult && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Enter your monthly salary above to see your home loan eligibility
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Max EMI = 50% of gross salary − existing EMIs (standard FOIR). Actual eligibility varies by bank,
        credit score, and income type. Consult a loan advisor before applying.
      </p>
    </div>
  );
}
