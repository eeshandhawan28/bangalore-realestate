import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  onAddProperty: () => void;
}

export function EmptyState({ onAddProperty }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-20 h-20 rounded-2xl bg-primary-highlight flex items-center justify-center mb-6">
        <Building2 className="w-10 h-10 text-primary" />
      </div>
      <h2 className="font-display text-xl font-semibold text-foreground mb-2">
        Your real estate portfolio starts here
      </h2>
      <p className="text-muted-foreground text-sm max-w-sm mb-6">
        Add your first property to track its value, see appreciation over time,
        and get AI-powered valuations.
      </p>
      <Button
        onClick={onAddProperty}
        className="bg-primary hover:bg-primary-hover text-white"
      >
        Add First Property
      </Button>
    </div>
  );
}
