"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { LocalitySearch } from "@/components/shared/LocalitySearch";
import { ValuationInput } from "@/lib/valuation";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const AREA_TYPES = [
  "Super Built-up",
  "Built-up",
  "Plot",
  "Carpet",
];

interface ValuationFormProps {
  onSubmit: (input: ValuationInput) => void;
  loading?: boolean;
}

export function ValuationForm({ onSubmit, loading }: ValuationFormProps) {
  const [location, setLocation] = useState("");
  const [areaType, setAreaType] = useState("Super Built-up");
  const [totalSqft, setTotalSqft] = useState("");
  const [bhk, setBhk] = useState(2);
  const [bathrooms, setBathrooms] = useState(2);
  const [balconies, setBalconies] = useState(1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!location || !totalSqft) return;
    onSubmit({
      location,
      area_type: areaType,
      total_sqft: parseFloat(totalSqft),
      bhk,
      bathrooms,
      balconies,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold text-foreground">
          Get an Instant Price Estimate
        </h1>
        <p className="text-sm text-muted-foreground">
          Powered by 13,000+ Bangalore property transactions
        </p>
      </div>

      {/* Location */}
      <div className="space-y-2">
        <Label>Location</Label>
        <LocalitySearch
          value={location}
          onChange={setLocation}
          placeholder="Search Bangalore locality..."
        />
      </div>

      {/* Area Type */}
      <div className="space-y-2">
        <Label>Area Type</Label>
        <RadioGroup
          value={areaType}
          onValueChange={setAreaType}
          className="grid grid-cols-2 gap-2"
        >
          {AREA_TYPES.map((type) => (
            <div key={type} className="flex items-center space-x-2">
              <RadioGroupItem value={type} id={`area-${type}`} />
              <Label
                htmlFor={`area-${type}`}
                className="font-normal cursor-pointer"
              >
                {type}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* Total Sqft */}
      <div className="space-y-2">
        <Label htmlFor="sqft">Total Area (sqft)</Label>
        <Input
          id="sqft"
          type="number"
          placeholder="e.g. 1200"
          min={200}
          max={50000}
          value={totalSqft}
          onChange={(e) => setTotalSqft(e.target.value)}
          required
        />
      </div>

      {/* BHK */}
      <div className="space-y-2">
        <Label>BHK</Label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setBhk(n)}
              className={cn(
                "flex-1 py-2 rounded-lg border text-sm font-medium transition-colors",
                bhk === n
                  ? "bg-primary text-white border-primary"
                  : "bg-surface border-border text-foreground hover:border-primary"
              )}
            >
              {n === 5 ? "5+" : n}
            </button>
          ))}
        </div>
      </div>

      {/* Bathrooms */}
      <div className="space-y-2">
        <Label>Bathrooms</Label>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => setBathrooms(Math.max(1, bathrooms - 1))}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="w-8 text-center font-medium">{bathrooms}</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => setBathrooms(Math.min(6, bathrooms + 1))}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Balconies */}
      <div className="space-y-2">
        <Label>Balconies</Label>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => setBalconies(Math.max(0, balconies - 1))}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="w-8 text-center font-medium">{balconies}</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => setBalconies(Math.min(4, balconies + 1))}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Button
        type="submit"
        className="w-full bg-primary hover:bg-primary-hover text-white"
        disabled={!location || !totalSqft || loading}
      >
        {loading ? "Calculating..." : "Get Estimate"}
      </Button>
    </form>
  );
}
