import { FairPriceBadge } from "./FairPriceBadge";
import { formatLakhs } from "@/lib/utils/format";
import { MapPin, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Listing {
  id: string;
  listing_type: string;
  title: string;
  location: string;
  area_type: string;
  total_sqft: number;
  bhk: number;
  bathrooms: number;
  balconies: number;
  asking_price_lakhs: number | null;
  monthly_rent?: number | null;
  ai_estimated_price_lakhs: number;
  description: string;
  contact_email: string;
  contact_phone: string;
  created_at: string;
}

interface ListingCardProps {
  listing: Listing;
}

export function ListingCard({ listing }: ListingCardProps) {
  const isSale = listing.listing_type === "sale";

  return (
    <div className="bg-surface border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-4">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-foreground text-sm leading-snug">
            {listing.title}
          </h3>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
              isSale
                ? "bg-[#d0e8da] text-[#1a5c3a] dark:bg-[#1a3528] dark:text-[#6fbc3a]"
                : "bg-[#dceef8] text-[#006494] dark:bg-[#0a2030] dark:text-[#4da9d8]"
            }`}
          >
            {isSale ? "For Sale" : "For Rent"}
          </span>
        </div>
        <div className="flex items-center gap-1 mt-1">
          <MapPin className="w-3 h-3 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">{listing.location}</p>
        </div>
      </div>

      {/* Property details row */}
      <div className="flex gap-2 flex-wrap">
        <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-md">
          {listing.bhk} BHK
        </span>
        <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-md">
          {listing.total_sqft.toLocaleString("en-IN")} sqft
        </span>
        <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-md">
          {listing.area_type}
        </span>
      </div>

      {/* Price */}
      <div className="space-y-1">
        {isSale && listing.asking_price_lakhs ? (
          <>
            <p className="text-xl font-display font-semibold text-foreground">
              {formatLakhs(listing.asking_price_lakhs)}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <FairPriceBadge
                askingPrice={listing.asking_price_lakhs}
                aiEstimate={listing.ai_estimated_price_lakhs}
              />
              <p className="text-xs text-muted-foreground">
                AI Fair Value: ~{formatLakhs(listing.ai_estimated_price_lakhs)}
              </p>
            </div>
          </>
        ) : (
          <p className="text-xl font-display font-semibold text-foreground">
            ₹{listing.monthly_rent?.toLocaleString("en-IN")}/mo
          </p>
        )}
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground line-clamp-2">
        {listing.description}
      </p>

      {/* Contact */}
      <div className="flex gap-2 pt-1">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="flex-1 text-xs h-8"
        >
          <a href={`tel:${listing.contact_phone}`}>
            <Phone className="w-3 h-3 mr-1" />
            Call
          </a>
        </Button>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="flex-1 text-xs h-8"
        >
          <a href={`mailto:${listing.contact_email}`}>
            <Mail className="w-3 h-3 mr-1" />
            Email
          </a>
        </Button>
      </div>
    </div>
  );
}
