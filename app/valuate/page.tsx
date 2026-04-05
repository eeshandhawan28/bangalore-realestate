"use client";

import { useState } from "react";
import { ValuationForm } from "@/components/valuation/ValuationForm";
import { ValuationResult } from "@/components/valuation/ValuationResult";
import {
  calculateValuation,
  ValuationInput,
  ValuationResult as VResult,
} from "@/lib/valuation";

export default function ValuatePage() {
  const [result, setResult] = useState<VResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (input: ValuationInput) => {
    setLoading(true);
    // Simulate brief async (for UX)
    setTimeout(() => {
      const valuation = calculateValuation(input);
      setResult(valuation);
      setLoading(false);
    }, 400);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-content mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Form panel */}
          <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
            <ValuationForm onSubmit={handleSubmit} loading={loading} />
          </div>

          {/* Result panel */}
          <div>
            {result ? (
              <ValuationResult result={result} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center py-16 px-6 text-center border-2 border-dashed border-border rounded-xl">
                <div className="w-16 h-16 rounded-2xl bg-primary-highlight flex items-center justify-center mb-4">
                  <span className="text-3xl">🏠</span>
                </div>
                <p className="font-display text-lg font-semibold text-foreground">
                  Your estimate will appear here
                </p>
                <p className="text-sm text-muted-foreground mt-2 max-w-xs">
                  Fill in the property details and click &quot;Get Estimate&quot; to see
                  the AI-powered valuation.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
