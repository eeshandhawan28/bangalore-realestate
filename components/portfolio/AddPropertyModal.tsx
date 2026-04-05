"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { LocalitySearch } from "@/components/shared/LocalitySearch";
import { Property } from "@/lib/portfolio";
import { calculateValuation } from "@/lib/valuation";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const AREA_TYPES = ["Super Built-up", "Built-up", "Plot", "Carpet"];
const OWNERSHIP_TYPES = [
  { value: "self-occupied", label: "Self-occupied" },
  { value: "rented", label: "Rented" },
  { value: "under-construction", label: "Under construction" },
];

interface AddPropertyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Omit<Property, "id" | "created_at">) => void;
  editProperty?: Property | null;
}

export function AddPropertyModal({
  open,
  onOpenChange,
  onSave,
  editProperty,
}: AddPropertyModalProps) {
  const [step, setStep] = useState(1);

  // Step 1 fields
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [areaType, setAreaType] = useState("Super Built-up");
  const [totalSqft, setTotalSqft] = useState("");
  const [bhk, setBhk] = useState(2);
  const [bathrooms, setBathrooms] = useState(2);
  const [balconies, setBalconies] = useState(1);

  // Step 2 fields
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [ownershipType, setOwnershipType] = useState("self-occupied");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (editProperty) {
      setName(editProperty.name);
      setLocation(editProperty.location);
      setAreaType(editProperty.area_type);
      setTotalSqft(editProperty.total_sqft.toString());
      setBhk(editProperty.bhk);
      setBathrooms(editProperty.bathrooms);
      setBalconies(editProperty.balconies);
      setPurchasePrice(editProperty.purchase_price_lakhs.toString());
      setPurchaseDate(editProperty.purchase_date);
      setOwnershipType(editProperty.ownership_type);
      setNotes(editProperty.notes ?? "");
    } else {
      resetForm();
    }
  }, [editProperty, open]);

  function resetForm() {
    setStep(1);
    setName("");
    setLocation("");
    setAreaType("Super Built-up");
    setTotalSqft("");
    setBhk(2);
    setBathrooms(2);
    setBalconies(1);
    setPurchasePrice("");
    setPurchaseDate("");
    setOwnershipType("self-occupied");
    setNotes("");
  }

  const handleStep1Next = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !location || !totalSqft) return;
    setStep(2);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchasePrice || !purchaseDate) return;

    const valuation = calculateValuation({
      location,
      area_type: areaType,
      total_sqft: parseFloat(totalSqft),
      bhk,
      bathrooms,
      balconies,
    });

    onSave({
      name,
      location,
      area_type: areaType,
      total_sqft: parseFloat(totalSqft),
      bhk,
      bathrooms,
      balconies,
      purchase_price_lakhs: parseFloat(purchasePrice),
      purchase_date: purchaseDate,
      ownership_type: ownershipType as Property["ownership_type"],
      notes: notes || undefined,
      ai_estimated_value_lakhs: valuation.predicted_price_lakhs,
    });

    onOpenChange(false);
    resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-surface border-border">
        <DialogHeader>
          <DialogTitle className="font-display">
            {editProperty ? "Edit Property" : "Add Property"}{" "}
            <span className="text-muted-foreground font-normal text-sm ml-2">
              Step {step} of 2
            </span>
          </DialogTitle>
        </DialogHeader>

        {step === 1 ? (
          <form onSubmit={handleStep1Next} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prop-name">Property Name</Label>
              <Input
                id="prop-name"
                placeholder='e.g. "2BHK in Whitefield"'
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Location</Label>
              <LocalitySearch
                value={location}
                onChange={setLocation}
                placeholder="Search locality..."
              />
            </div>

            <div className="space-y-2">
              <Label>Area Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {AREA_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setAreaType(type)}
                    className={cn(
                      "py-2 px-3 rounded-lg border text-sm transition-colors text-left",
                      areaType === type
                        ? "bg-primary text-white border-primary"
                        : "bg-surface border-border hover:border-primary"
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

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
                        : "bg-surface border-border hover:border-primary"
                    )}
                  >
                    {n === 5 ? "5+" : n}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bathrooms</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setBathrooms(Math.max(1, bathrooms - 1))}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-6 text-center text-sm font-medium">
                    {bathrooms}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setBathrooms(Math.min(6, bathrooms + 1))}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Balconies</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setBalconies(Math.max(0, balconies - 1))}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-6 text-center text-sm font-medium">
                    {balconies}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setBalconies(Math.min(4, balconies + 1))}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary-hover text-white"
              disabled={!name || !location || !totalSqft}
            >
              Next: Purchase Details
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="price">Purchase Price (Lakhs)</Label>
              <Input
                id="price"
                type="number"
                placeholder="e.g. 85"
                step="0.1"
                min={1}
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Purchase Date</Label>
              <Input
                id="date"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Ownership Type</Label>
              <RadioGroup
                value={ownershipType}
                onValueChange={setOwnershipType}
                className="space-y-2"
              >
                {OWNERSHIP_TYPES.map((type) => (
                  <div key={type.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={type.value} id={`ownership-${type.value}`} />
                    <Label
                      htmlFor={`ownership-${type.value}`}
                      className="font-normal cursor-pointer"
                    >
                      {type.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Input
                id="notes"
                placeholder="Any additional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setStep(1)}
              >
                Back
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-primary hover:bg-primary-hover text-white"
                disabled={!purchasePrice || !purchaseDate}
              >
                {editProperty ? "Save Changes" : "Add Property"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
