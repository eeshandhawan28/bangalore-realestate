import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Lock } from "lucide-react";

export default function ListPropertyPage() {
  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display text-2xl font-semibold text-foreground mb-8">
        List a Property
      </h1>

      <div className="max-w-md mx-auto text-center py-16 px-6 bg-surface border border-border rounded-xl shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-primary-highlight flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-primary" />
        </div>
        <h2 className="font-display text-lg font-semibold text-foreground mb-2">
          Authentication Required
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Property listing creation will be available in Phase 2 when
          authentication and Supabase integration are enabled.
        </p>
        <Button asChild variant="outline">
          <Link href="/marketplace">Browse Listings</Link>
        </Button>
      </div>
    </div>
  );
}
