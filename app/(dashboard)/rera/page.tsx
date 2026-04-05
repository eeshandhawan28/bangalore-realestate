"use client";

import { useState, useMemo } from "react";
import Fuse from "fuse.js";
import reraProjects from "@/lib/data/rera_projects.json";
import { ReraResultCard } from "@/components/rera/ReraResultCard";
import { Input } from "@/components/ui/input";
import { Search, Shield, ExternalLink } from "lucide-react";

type ReraProject = (typeof reraProjects)[0];

const fuse = new Fuse(reraProjects, {
  keys: ["project_name", "rera_number", "developer", "location"],
  threshold: 0.4,
  minMatchCharLength: 2,
});

export default function ReraPage() {
  const [query, setQuery] = useState("");

  const results = useMemo<ReraProject[]>(() => {
    if (!query.trim() || query.trim().length < 2) return [];
    return fuse.search(query).map((r) => r.item);
  }, [query]);

  const showEmpty = query.trim().length < 2;
  const showNoResults = query.trim().length >= 2 && results.length === 0;

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold text-foreground">
          RERA Checker
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Verify if a developer project is registered under RERA Karnataka
          before investing.
        </p>
      </div>

      {/* Search */}
      <div className="max-w-xl mx-auto mb-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Search by project name, developer, or RERA number..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-12 h-12 text-sm"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Searching across {reraProjects.length} RERA-registered Bangalore
          projects
        </p>
      </div>

      {/* Results */}
      {showEmpty && (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-primary-highlight flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <p className="font-display text-lg font-semibold text-foreground mb-2">
            Verify before you invest
          </p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Enter a project name, developer name, or RERA registration number to
            check if it&apos;s registered.
          </p>
        </div>
      )}

      {showNoResults && (
        <div className="max-w-xl mx-auto text-center py-12 px-6 bg-surface border border-border rounded-xl">
          <p className="font-semibold text-foreground mb-2">
            No matching projects found
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            This doesn&apos;t necessarily mean the project is unregistered — our
            dataset covers {reraProjects.length} projects. Verify on the
            official portal for complete results.
          </p>
          <a
            href="https://rera.karnataka.gov.in/viewAllProjects"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Search on RERA Karnataka
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {results.length > 0 && (
        <div className="max-w-2xl mx-auto space-y-4">
          <p className="text-sm text-muted-foreground">
            {results.length} result{results.length !== 1 ? "s" : ""} found
          </p>
          {results.map((project) => (
            <ReraResultCard key={project.rera_number} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
