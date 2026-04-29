"use client";

import { useEffect, useState, useCallback } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { supabase } from "@/lib/supabase";
import { useOrgContext } from "@/lib/hooks/useOrgContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, IndianRupee, CalendarDays, User2, TrendingUp } from "lucide-react";
import { format } from "date-fns";

type PipelineStage = {
  id: string;
  name: string;
  color: string;
  position: number;
  win_probability: number;
};

type Deal = {
  id: string;
  title: string;
  value_lakhs: number | null;
  expected_close: string | null;
  probability: number | null;
  stage_id: string;
  contact_name: string | null;
  contact_company: string | null;
};

// ── Deal Card (draggable) ─────────────────────────────────────
function DealCard({ deal, stageColor, isDragging = false }: {
  deal: Deal; stageColor?: string; isDragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: deal.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`bg-surface border border-border rounded-lg p-3 cursor-grab active:cursor-grabbing shadow-sm select-none transition-shadow ${
        isDragging ? "opacity-0" : "hover:shadow-md hover:border-primary/30"
      }`}
    >
      <DealCardContent deal={deal} stageColor={stageColor} />
    </div>
  );
}

function DealCardContent({ deal, stageColor }: { deal: Deal; stageColor?: string }) {
  return (
    <>
      <p className="text-sm font-medium text-foreground leading-snug mb-2">{deal.title}</p>
      {deal.contact_name && (
        <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
          <User2 className="w-3 h-3" />
          {deal.contact_name}
          {deal.contact_company ? ` · ${deal.contact_company}` : ""}
        </p>
      )}
      <div className="flex items-center justify-between flex-wrap gap-1">
        {deal.value_lakhs != null && (
          <span className="text-xs font-semibold text-foreground flex items-center gap-0.5">
            <IndianRupee className="w-3 h-3" />
            {deal.value_lakhs}L
          </span>
        )}
        {deal.expected_close && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <CalendarDays className="w-3 h-3" />
            {format(new Date(deal.expected_close), "dd MMM")}
          </span>
        )}
        {deal.probability != null && (
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: `${stageColor ?? "#6366f1"}20`, color: stageColor ?? "#6366f1" }}
          >
            {deal.probability}%
          </span>
        )}
      </div>
    </>
  );
}

// ── Stage Column (droppable) ──────────────────────────────────
function StageColumn({
  stage, deals, totalLakhs, onAddDeal,
}: {
  stage: PipelineStage;
  deals: Deal[];
  totalLakhs: number;
  onAddDeal: () => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: stage.id });

  return (
    <div className="flex-shrink-0 w-72">
      {/* Stage header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color || "#6366f1" }} />
          <span className="text-sm font-semibold text-foreground">{stage.name}</span>
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
            {deals.length}
          </span>
        </div>
        {totalLakhs > 0 && (
          <span className="text-xs font-medium text-muted-foreground">
            ₹{totalLakhs.toLocaleString("en-IN")}L
          </span>
        )}
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`min-h-[200px] rounded-xl p-2 space-y-2 transition-colors ${
          isOver ? "bg-primary/5 border-2 border-primary/30 border-dashed" : "bg-muted/30"
        }`}
      >
        {deals.map((d) => (
          <DealCard key={d.id} deal={d} stageColor={stage.color} />
        ))}
        <button
          onClick={onAddDeal}
          className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 py-2.5 rounded-lg hover:bg-muted transition-colors border border-dashed border-border"
        >
          <Plus className="w-3.5 h-3.5" />Add deal
        </button>
      </div>
    </div>
  );
}

// ── Create Deal Modal ─────────────────────────────────────────
function CreateDealModal({
  open, onClose, orgId, stages, defaultStageId, onCreated,
}: {
  open: boolean; onClose: () => void; orgId: string;
  stages: PipelineStage[]; defaultStageId?: string; onCreated: () => void;
}) {
  const [form, setForm] = useState({
    title: "", value_lakhs: "", expected_close: "",
    stage_id: defaultStageId ?? stages[0]?.id ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) setForm((p) => ({ ...p, stage_id: defaultStageId ?? stages[0]?.id ?? "" }));
  }, [open, defaultStageId, stages]);

  const submit = async () => {
    if (!form.title.trim()) { setError("Deal title is required."); return; }
    setSaving(true); setError("");
    const { data: { user } } = await supabase.auth.getUser();
    const stage = stages.find((s) => s.id === form.stage_id);
    const { data: pipeline } = await supabase
      .from("pipeline_stages")
      .select("pipeline_id")
      .eq("id", form.stage_id)
      .single();
    const { error: err } = await supabase.from("deals").insert({
      organization_id: orgId,
      pipeline_id: pipeline?.pipeline_id,
      stage_id: form.stage_id,
      title: form.title.trim(),
      value_lakhs: form.value_lakhs ? parseFloat(form.value_lakhs) : null,
      expected_close: form.expected_close || null,
      probability: stage?.win_probability ?? null,
      assigned_to: user?.id,
      created_by: user?.id,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setForm({ title: "", value_lakhs: "", expected_close: "", stage_id: stages[0]?.id ?? "" });
    onCreated();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>New Deal</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Title *</label>
            <Input placeholder="e.g. 3BHK Sale — Whitefield" value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Stage</label>
            <Select value={form.stage_id} onValueChange={(v) => setForm((p) => ({ ...p, stage_id: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Value (₹ Lakhs)</label>
              <Input type="number" placeholder="e.g. 85" value={form.value_lakhs}
                onChange={(e) => setForm((p) => ({ ...p, value_lakhs: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Close Date</label>
              <Input type="date" value={form.expected_close}
                onChange={(e) => setForm((p) => ({ ...p, expected_close: e.target.value }))} />
            </div>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={submit} disabled={saving}>
              {saving ? "Saving…" : "Create Deal"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function PipelinePage() {
  const { orgId, loading: orgLoading } = useOrgContext();
  const [stages, setStages]   = useState<PipelineStage[]>([]);
  const [deals, setDeals]     = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showCreate, setShowCreate]       = useState(false);
  const [defaultStageId, setDefaultStageId] = useState<string | undefined>();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const fetchData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);

    // Get the default pipeline first
    const { data: pipeline } = await supabase
      .from("pipelines")
      .select("id")
      .eq("organization_id", orgId)
      .eq("is_default", true)
      .limit(1)
      .single();

    if (!pipeline) {
      // Seed a default pipeline
      const { data: newPipeline } = await supabase.from("pipelines").insert({
        organization_id: orgId, name: "Sales Pipeline", is_default: true,
      }).select("id").single();
      if (newPipeline) {
        const seedStages = [
          { pipeline_id: newPipeline.id, name: "Prospecting",  position: 1, color: "#94a3b8", win_probability: 10 },
          { pipeline_id: newPipeline.id, name: "Proposal",     position: 2, color: "#6366f1", win_probability: 30 },
          { pipeline_id: newPipeline.id, name: "Negotiation",  position: 3, color: "#f59e0b", win_probability: 60 },
          { pipeline_id: newPipeline.id, name: "Closed Won",   position: 4, color: "#10b981", win_probability: 100 },
          { pipeline_id: newPipeline.id, name: "Closed Lost",  position: 5, color: "#ef4444", win_probability: 0 },
        ];
        await supabase.from("pipeline_stages").insert(seedStages);
      }
      fetchData();
      return;
    }

    const [stagesRes, dealsRes] = await Promise.all([
      supabase.from("pipeline_stages")
        .select("id,name,color,position,win_probability")
        .eq("pipeline_id", pipeline.id)
        .order("position"),
      supabase.from("deals")
        .select(`id,title,value_lakhs,expected_close,probability,stage_id,
          contacts(first_name,last_name,company)`)
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false }),
    ]);

    setStages((stagesRes.data as PipelineStage[]) ?? []);
    type DealRow = Deal & { contacts: { first_name: string; last_name: string | null; company: string | null } | null };
    setDeals(
      ((dealsRes.data ?? []) as unknown as DealRow[]).map((d) => ({
        ...d,
        contact_name: d.contacts ? `${d.contacts.first_name} ${d.contacts.last_name ?? ""}`.trim() : null,
        contact_company: d.contacts?.company ?? null,
      }))
    );
    setLoading(false);
  }, [orgId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const dealId   = String(active.id);
    const stageId  = String(over.id);
    const stage    = stages.find((s) => s.id === stageId);
    if (!stage) return;

    // Optimistic update
    setDeals((prev) => prev.map((d) =>
      d.id === dealId ? { ...d, stage_id: stageId, probability: stage.win_probability } : d
    ));

    await supabase.from("deals")
      .update({ stage_id: stageId, probability: stage.win_probability })
      .eq("id", dealId);
  };

  const activeDeal = deals.find((d) => d.id === activeId);
  const activeStage = activeDeal ? stages.find((s) => s.id === activeDeal.stage_id) : null;

  // Pipeline totals
  const totalPipeline = deals.reduce((s, d) => s + (d.value_lakhs ?? 0), 0);
  const weightedForecast = deals.reduce((s, d) => s + (d.value_lakhs ?? 0) * ((d.probability ?? 0) / 100), 0);

  if (orgLoading || loading) return (
    <div className="px-4 sm:px-6 py-8">
      <div className="flex gap-4 overflow-x-auto pb-4">
        {[1,2,3,4].map(i => (
          <div key={i} className="flex-shrink-0 w-72 space-y-2">
            <Skeleton className="h-6 w-32 mb-3" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-0px)] overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-6 py-5 border-b border-border bg-surface flex items-center justify-between flex-wrap gap-3 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-foreground">Pipeline</h1>
          <div className="flex items-center gap-4 mt-0.5">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              ₹{Math.round(totalPipeline).toLocaleString("en-IN")}L total
            </span>
            <span className="text-xs text-muted-foreground">
              ₹{Math.round(weightedForecast).toLocaleString("en-IN")}L weighted
            </span>
            <span className="text-xs text-muted-foreground">{deals.length} deals</span>
          </div>
        </div>
        <Button onClick={() => { setDefaultStageId(stages[0]?.id); setShowCreate(true); }} className="gap-2">
          <Plus className="w-4 h-4" />New Deal
        </Button>
      </div>

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 px-4 sm:px-6 py-6 min-w-max">
            {stages.map((stage) => {
              const stageDeals = deals.filter((d) => d.stage_id === stage.id);
              const stageLakhs = stageDeals.reduce((s, d) => s + (d.value_lakhs ?? 0), 0);
              return (
                <StageColumn
                  key={stage.id}
                  stage={stage}
                  deals={stageDeals}
                  totalLakhs={stageLakhs}
                  onAddDeal={() => { setDefaultStageId(stage.id); setShowCreate(true); }}
                />
              );
            })}
          </div>

          <DragOverlay>
            {activeDeal && (
              <div className="bg-surface border-2 border-primary rounded-lg p-3 shadow-xl w-72 opacity-95">
                <DealCardContent deal={activeDeal} stageColor={activeStage?.color} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {orgId && (
        <CreateDealModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          orgId={orgId}
          stages={stages}
          defaultStageId={defaultStageId}
          onCreated={fetchData}
        />
      )}
    </div>
  );
}
