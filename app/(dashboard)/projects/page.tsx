"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useOrgContext } from "@/lib/hooks/useOrgContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus, FolderKanban, MapPin, Calendar, IndianRupee,
  ChevronRight, AlertCircle,
} from "lucide-react";
import { format } from "date-fns";

type ProjectStatus =
  | "pre_development" | "planning" | "procurement"
  | "construction" | "closeout" | "completed" | "on_hold";

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  location: string | null;
  start_date: string | null;
  target_end_date: string | null;
  budget_lakhs: number | null;
  spent_lakhs: number | null;
  tags: string[];
  created_at: string;
};

const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; dot: string }> = {
  pre_development: { label: "Pre-Dev",     color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",   dot: "bg-gray-400" },
  planning:        { label: "Planning",    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",  dot: "bg-blue-500" },
  procurement:     { label: "Procurement", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300", dot: "bg-yellow-500" },
  construction:    { label: "Construction",color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300", dot: "bg-orange-500" },
  closeout:        { label: "Closeout",    color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300", dot: "bg-purple-500" },
  completed:       { label: "Completed",   color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",  dot: "bg-green-500" },
  on_hold:         { label: "On Hold",     color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",    dot: "bg-red-500" },
};

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  ...Object.entries(STATUS_CONFIG).map(([k, v]) => ({ value: k, label: v.label })),
];

// ── Project Card ──────────────────────────────────────────────
function ProjectCard({ project }: { project: Project }) {
  const cfg = STATUS_CONFIG[project.status];
  const utilPct = project.budget_lakhs && project.spent_lakhs != null
    ? Math.min(Math.round((project.spent_lakhs / project.budget_lakhs) * 100), 100) : null;
  const isOverBudget = utilPct != null && utilPct >= 100;

  return (
    <Link href={`/projects/${project.id}`}>
      <div className="bg-surface border border-border rounded-xl p-5 shadow-sm hover:border-primary/40 hover:shadow-md transition-all group">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors leading-snug">
              {project.name}
            </h3>
            {project.location && (
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <MapPin className="w-3 h-3" />{project.location}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>
              {cfg.label}
            </span>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </div>

        {project.description && (
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{project.description}</p>
        )}

        {/* Budget bar */}
        {project.budget_lakhs && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <IndianRupee className="w-2.5 h-2.5" />Budget
              </span>
              <span className={`text-[10px] font-medium ${isOverBudget ? "text-red-500" : "text-muted-foreground"}`}>
                ₹{project.spent_lakhs ?? 0}L / ₹{project.budget_lakhs}L
                {utilPct != null && ` (${utilPct}%)`}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isOverBudget ? "bg-red-500" : "bg-primary"}`}
                style={{ width: `${utilPct ?? 0}%` }}
              />
            </div>
            {isOverBudget && (
              <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />Over budget
              </p>
            )}
          </div>
        )}

        {/* Dates */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
          {project.start_date && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Start: {format(new Date(project.start_date), "dd MMM yyyy")}
            </span>
          )}
          {project.target_end_date && (
            <span className="flex items-center gap-1">
              Target: {format(new Date(project.target_end_date), "dd MMM yyyy")}
            </span>
          )}
        </div>

        {/* Tags */}
        {project.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {project.tags.slice(0, 3).map((t) => (
              <span key={t} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{t}</span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

// ── Create Project Modal ──────────────────────────────────────
function CreateProjectModal({
  open, onClose, orgId, onCreated,
}: { open: boolean; onClose: () => void; orgId: string; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: "", description: "", status: "planning" as ProjectStatus,
    location: "", start_date: "", target_end_date: "", budget_lakhs: "", tags: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) { setError("Project name is required."); return; }
    setSaving(true); setError("");
    const { data: { user } } = await supabase.auth.getUser();
    const { error: err } = await supabase.from("projects").insert({
      organization_id: orgId,
      name: form.name.trim(),
      description: form.description.trim() || null,
      status: form.status,
      location: form.location.trim() || null,
      start_date: form.start_date || null,
      target_end_date: form.target_end_date || null,
      budget_lakhs: form.budget_lakhs ? parseFloat(form.budget_lakhs) : null,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      created_by: user?.id,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setForm({ name: "", description: "", status: "planning", location: "", start_date: "", target_end_date: "", budget_lakhs: "", tags: "" });
    onCreated();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New Project</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Project Name *</label>
            <Input placeholder="e.g. Prestige Park — Phase 2" value={form.name}
              onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[72px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Brief description of the project…"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Location</label>
            <Input placeholder="e.g. Whitefield, Bangalore" value={form.location}
              onChange={(e) => set("location", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Start Date</label>
              <Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Target End</label>
              <Input type="date" value={form.target_end_date} onChange={(e) => set("target_end_date", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Budget (₹ Lakhs)</label>
            <Input type="number" placeholder="e.g. 500" value={form.budget_lakhs}
              onChange={(e) => set("budget_lakhs", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Tags (comma-separated)</label>
            <Input placeholder="e.g. residential, Q3-2025" value={form.tags}
              onChange={(e) => set("tags", e.target.value)} />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={submit} disabled={saving}>
              {saving ? "Saving…" : "Create Project"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function ProjectsPage() {
  const { orgId, loading: orgLoading } = useOrgContext();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (!orgLoading && !orgId) setLoading(false);
  }, [orgLoading, orgId]);

  const fetchProjects = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const { data } = await supabase
      .from("projects")
      .select("id,name,description,status,location,start_date,target_end_date,budget_lakhs,spent_lakhs,tags,created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });
    setProjects((data as Project[]) ?? []);
    setLoading(false);
  }, [orgId]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const filtered = statusFilter === "all"
    ? projects
    : projects.filter((p) => p.status === statusFilter);

  // Status summary counts
  const counts = projects.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});

  if (orgLoading) return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[1,2,3].map(i=><Skeleton key={i} className="h-40 rounded-xl"/>)}
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Projects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{projects.length} project{projects.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" />New Project
        </Button>
      </div>

      {/* Status summary pills */}
      {projects.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {Object.entries(STATUS_CONFIG)
            .filter(([k]) => counts[k])
            .map(([k, v]) => (
              <div key={k} className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${v.color}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${v.dot}`} />
                {v.label}: {counts[k]}
              </div>
            ))}
        </div>
      )}

      {/* Status filter */}
      <div className="flex gap-1 flex-wrap mb-5">
        {STATUS_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setStatusFilter(value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              statusFilter === value
                ? "bg-primary text-white border-primary"
                : "bg-surface text-muted-foreground border-border hover:border-primary/40"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3,4].map(i=><Skeleton key={i} className="h-44 rounded-xl"/>)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <FolderKanban className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">
            {statusFilter !== "all" ? "No projects with this status" : "No projects yet"}
          </p>
          {statusFilter === "all" && (
            <Button variant="outline" className="mt-4" onClick={() => setShowCreate(true)}>
              Create your first project
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p) => <ProjectCard key={p.id} project={p} />)}
        </div>
      )}

      {orgId && (
        <CreateProjectModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          orgId={orgId}
          onCreated={fetchProjects}
        />
      )}
    </div>
  );
}
