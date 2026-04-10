"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Property,
  getProperties,
  addProperty,
  updateProperty,
  deleteProperty,
  getPortfolioSummary,
} from "@/lib/portfolio";
import { calculateValuation } from "@/lib/valuation";
import { supabase } from "@/lib/supabase";
import { PortfolioSummaryBar } from "@/components/portfolio/PortfolioSummaryBar";
import { PortfolioMetricsRow } from "@/components/portfolio/PortfolioMetricsRow";
import { PortfolioInsights } from "@/components/portfolio/PortfolioInsights";
import { PortfolioCharts } from "@/components/portfolio/PortfolioCharts";
import { PropertyCard } from "@/components/portfolio/PropertyCard";
import { AddPropertyModal } from "@/components/portfolio/AddPropertyModal";
import { PropertyDetailDrawer } from "@/components/portfolio/PropertyDetailDrawer";
import { EmptyState } from "@/components/portfolio/EmptyState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus } from "lucide-react";

export default function PortfolioPage() {
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [drawerProperty, setDrawerProperty] = useState<Property | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const loadProperties = useCallback(async () => {
    const data = await getProperties();
    setProperties(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push("/login");
        return;
      }
      setAuthed(true);
      loadProperties();
    });
  }, [loadProperties, router]);

  const handleSave = async (data: Omit<Property, "id" | "created_at" | "user_id">) => {
    if (editingProperty) {
      await updateProperty(editingProperty.id, data);
    } else {
      await addProperty(data);
    }
    setEditingProperty(null);
    await loadProperties();
  };

  const handleEdit = (property: Property) => {
    setEditingProperty(property);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this property?")) {
      await deleteProperty(id);
      await loadProperties();
    }
  };

  const handleRefresh = async (property: Property) => {
    const valuation = calculateValuation({
      location: property.location,
      area_type: property.area_type,
      total_sqft: property.total_sqft,
      bhk: property.bhk,
      bathrooms: property.bathrooms,
      balconies: property.balconies,
    });
    await updateProperty(property.id, {
      ai_estimated_value_lakhs: valuation.predicted_price_lakhs,
    });
    await loadProperties();
  };

  const handleCardClick = (property: Property) => {
    setDrawerProperty(property);
    setDrawerOpen(true);
  };

  if (!authed || loading) {
    return (
      <div className="max-w-content mx-auto px-4 sm:px-6 py-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const summary = getPortfolioSummary(properties);

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-semibold text-foreground">
          My Portfolio
        </h1>
        {properties.length > 0 && (
          <Button
            onClick={() => {
              setEditingProperty(null);
              setModalOpen(true);
            }}
            className="bg-primary hover:bg-primary-hover text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Property
          </Button>
        )}
      </div>

      {properties.length === 0 ? (
        <EmptyState
          onAddProperty={() => {
            setEditingProperty(null);
            setModalOpen(true);
          }}
        />
      ) : (
        <>
          <PortfolioSummaryBar summary={summary} />
          <PortfolioMetricsRow properties={properties} />
          <PortfolioInsights properties={properties} />
          <PortfolioCharts properties={properties} />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-6">
            {properties.map((property, index) => (
              <div
                key={property.id}
                className="animate-fade-in-up"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <PropertyCard
                  property={property}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onRefresh={handleRefresh}
                  onClick={handleCardClick}
                />
              </div>
            ))}
          </div>
        </>
      )}

      <AddPropertyModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setEditingProperty(null);
        }}
        onSave={handleSave}
        editProperty={editingProperty}
      />

      <PropertyDetailDrawer
        property={drawerProperty}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
