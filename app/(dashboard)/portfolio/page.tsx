"use client";

import { useState, useEffect } from "react";
import {
  Property,
  getProperties,
  addProperty,
  updateProperty,
  deleteProperty,
  getPortfolioSummary,
} from "@/lib/portfolio";
import { calculateValuation } from "@/lib/valuation";
import { PortfolioSummaryBar } from "@/components/portfolio/PortfolioSummaryBar";
import { PropertyCard } from "@/components/portfolio/PropertyCard";
import { AddPropertyModal } from "@/components/portfolio/AddPropertyModal";
import { PropertyDetailDrawer } from "@/components/portfolio/PropertyDetailDrawer";
import { EmptyState } from "@/components/portfolio/EmptyState";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function PortfolioPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [drawerProperty, setDrawerProperty] = useState<Property | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setProperties(getProperties());
  }, []);

  const handleSave = (data: Omit<Property, "id" | "created_at">) => {
    if (editingProperty) {
      const updated = updateProperty(editingProperty.id, data);
      if (updated) {
        setProperties(getProperties());
      }
    } else {
      addProperty(data);
      setProperties(getProperties());
    }
    setEditingProperty(null);
  };

  const handleEdit = (property: Property) => {
    setEditingProperty(property);
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this property?")) {
      deleteProperty(id);
      setProperties(getProperties());
    }
  };

  const handleRefresh = (property: Property) => {
    const valuation = calculateValuation({
      location: property.location,
      area_type: property.area_type,
      total_sqft: property.total_sqft,
      bhk: property.bhk,
      bathrooms: property.bathrooms,
      balconies: property.balconies,
    });
    updateProperty(property.id, {
      ai_estimated_value_lakhs: valuation.predicted_price_lakhs,
    });
    setProperties(getProperties());
  };

  const handleCardClick = (property: Property) => {
    setDrawerProperty(property);
    setDrawerOpen(true);
  };

  const summary = getPortfolioSummary(properties);

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 py-8">
      {/* Page header */}
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

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-6">
            {properties.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onRefresh={handleRefresh}
                onClick={handleCardClick}
              />
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
