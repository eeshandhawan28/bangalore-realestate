import { cn } from "@/lib/utils";

interface FairPriceBadgeProps {
  askingPrice: number;
  aiEstimate: number;
  className?: string;
}

export function FairPriceBadge({
  askingPrice,
  aiEstimate,
  className,
}: FairPriceBadgeProps) {
  if (!askingPrice || !aiEstimate) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground",
          className
        )}
      >
        Price not listed
      </span>
    );
  }

  const diff = ((askingPrice - aiEstimate) / aiEstimate) * 100;

  if (diff < -5) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-[#d0e8da] text-[#1a5c3a] dark:bg-[#1a3528] dark:text-[#6fbc3a]",
          className
        )}
      >
        {Math.abs(diff).toFixed(1)}% BELOW FAIR VALUE
      </span>
    );
  }

  if (diff <= 5) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-[#d0e8da] text-[#437a22] dark:bg-[#1a3528] dark:text-[#6fbc3a]",
          className
        )}
      >
        FAIRLY PRICED
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-[#f5d0d5] text-[#a13544] dark:bg-[#3a1520] dark:text-[#e05c6e]",
        className
      )}
    >
      {diff.toFixed(1)}% ABOVE FAIR VALUE
    </span>
  );
}
