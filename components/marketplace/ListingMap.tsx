"use client";

import { useJsApiLoader, GoogleMap, Marker, InfoWindow } from "@react-google-maps/api";
import { useState, useCallback } from "react";
import { MapPin, Phone, Mail, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FairPriceBadge } from "./FairPriceBadge";
import { formatLakhs } from "@/lib/utils/format";

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
  lat: number;
  lng: number;
}

interface ListingMapProps {
  listings: Listing[];
}

const BANGALORE_CENTER = { lat: 12.9352, lng: 77.6245 };
const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };

export function ListingMap({ listings }: ListingMapProps) {
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
  });

  const handleMarkerClick = useCallback((listing: Listing) => {
    setSelectedListing(listing);
  }, []);

  const handleMapClick = useCallback(() => {
    setSelectedListing(null);
  }, []);

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-full bg-muted rounded-xl">
        <p className="text-muted-foreground text-sm">Failed to load Google Maps.</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full bg-muted rounded-xl animate-pulse">
        <p className="text-muted-foreground text-sm">Loading map…</p>
      </div>
    );
  }

  const isSale = selectedListing?.listing_type === "sale";

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-border">
      <GoogleMap
        mapContainerStyle={MAP_CONTAINER_STYLE}
        center={BANGALORE_CENTER}
        zoom={12}
        onClick={handleMapClick}
        options={{
          disableDefaultUI: false,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
        }}
      >
        {listings.map((listing) => (
          <Marker
            key={listing.id}
            position={{ lat: listing.lat, lng: listing.lng }}
            onClick={() => handleMarkerClick(listing)}
            title={listing.title}
          />
        ))}

        {selectedListing && (
          <InfoWindow
            position={{ lat: selectedListing.lat, lng: selectedListing.lng }}
            onCloseClick={() => setSelectedListing(null)}
          >
            <div className="w-72 font-sans text-sm">
              {/* Header */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-gray-900 text-sm leading-snug">
                  {selectedListing.title}
                </h3>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                    isSale
                      ? "bg-green-100 text-green-800"
                      : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {isSale ? "For Sale" : "For Rent"}
                </span>
              </div>

              {/* Location */}
              <div className="flex items-center gap-1 mb-2">
                <MapPin className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-500">{selectedListing.location}</span>
              </div>

              {/* Specs */}
              <div className="flex gap-1.5 flex-wrap mb-2">
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                  {selectedListing.bhk} BHK
                </span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                  {selectedListing.total_sqft.toLocaleString("en-IN")} sqft
                </span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                  {selectedListing.area_type}
                </span>
              </div>

              {/* Price */}
              <div className="mb-2">
                {isSale && selectedListing.asking_price_lakhs ? (
                  <div>
                    <p className="text-lg font-bold text-gray-900">
                      {formatLakhs(selectedListing.asking_price_lakhs)}
                    </p>
                    <p className="text-xs text-gray-500">
                      AI Fair Value: ~{formatLakhs(selectedListing.ai_estimated_price_lakhs)}
                    </p>
                  </div>
                ) : (
                  <p className="text-lg font-bold text-gray-900">
                    ₹{selectedListing.monthly_rent?.toLocaleString("en-IN")}/mo
                  </p>
                )}
              </div>

              {/* Description */}
              <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                {selectedListing.description}
              </p>

              {/* Contact */}
              <div className="flex gap-2">
                <a
                  href={`tel:${selectedListing.contact_phone}`}
                  className="flex-1 flex items-center justify-center gap-1 text-xs border border-gray-200 rounded-md py-1.5 hover:bg-gray-50 text-gray-700"
                >
                  <Phone className="w-3 h-3" />
                  Call
                </a>
                <a
                  href={`mailto:${selectedListing.contact_email}`}
                  className="flex-1 flex items-center justify-center gap-1 text-xs border border-gray-200 rounded-md py-1.5 hover:bg-gray-50 text-gray-700"
                >
                  <Mail className="w-3 h-3" />
                  Email
                </a>
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}
