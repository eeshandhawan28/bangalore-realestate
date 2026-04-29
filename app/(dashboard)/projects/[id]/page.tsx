"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useOrgContext } from "@/lib/hooks/useOrgContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Plus, Calendar, AlertCircle, Clock,
  CheckCircle2, Circle, Loader2, Ban, Eye, IndianRupee, MapPin,
} from "lucide-react";
import { format, isPast, parseISO } from "date-fns";

type TaskStatus = "todo" | "in_progress" | "review" | "blocked" | "done";
type TaskPriority = "low" | "medium" | "high" | "urgent";
type ProjectStatus = "pre_development" | "planning" | "procurement" | "construction" | "closeout" | "completed" | "on_hold";

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
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assigned_to: string | null;
  estimated_hours: number | null;
  created_at: string;
};

const STATUS_COLUMNS: { status: TaskStatus; label: string; icon: React.ElementType; color: string }[] = [
  { status: "todo",        label: "To Do",      icon: Circle,       color: "text-gray-400" },
  { status: "in_progress", label: "In Progress", icon: Loader2,      color: "text-blue-500" },
  { status: "review",      label: "Review",      icon: Eye,          color: "text-purple-500" },
  { status: "blocked",     label: "Blocked",     icon: Ban,          color: "text-red-500" },
  { status: "done",        label: "Done",        icon: CheckCircle2, color: "text-green-500" },
];

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string }> = {
  low:    { label: "Low",    color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  medium: { label: "Medium", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  high:   { label: "High",   color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
  urgent: { label: "Urgent", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
};

const PROJECT_STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string }> = {
  pre_development: { label: "Pre-Dev",     color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  planning:        { label: "Planning",    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  procurement:     { label: "Procurement", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300" },
  construction:    { label: "Construction",color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
  closeout:        { label: "Closeout",    color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
  completed:       { label: "Completed",   color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  on_hold:         { label: "On Hold",     color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
};

// ── Task Card ─────────────────────────────────────────────────
function TaskCard({ task, onStatusChange }: { task: Task; onStatusChange: (id: string, s: TaskStatus) => void }) {
  const pCfg = PRIORITY_CONFIG[task.priority];
  const isOverdue = task.due_date && task.status !== "done" && isPast(parseISO(task.due_date));

  return (
    <div className={`bg-surface border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow ${
      isOverdue ? "border-red-300 dark:border-red-800" : "border-border"
    }`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium text-foreground leading-snug flex-1">{task.title}</p>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${pCfg.color}`}>
          {pCfg.label}
        </span>
      </div>
      {task.description && (
        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{task.description}</p>
      )}
      <div className="flex items-center justify-between flex-wrap gap-1.5">
        {task.due_date && (
          <span className={`text-[10px] flex items-center gap-1 ${isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
            {isOverdue ? <AlertCircle className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
            {format(parseISO(task.due_date), "dd MMM")}
            {isOverdue && " overdue"}
          </span>
        )}
        {task.estimated_hours && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />{task.estimated_hours}h
          </span>
        )}
        <Select value={task.status} onValueChange={(v) => onStatusChange(task.id, v as TaskStatus)}>
          <SelectTrigger className="h-6 text-[10px] border-0 bg-muted px-2 py-0 gap-1 w-auto min-w-[90px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_COLUMNS.map(({ status, label }) => (
              <SelectItem key={status} value={status} className="text-xs">{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// ── Create Task Modal ─────────────────────────────────────────
function CreateTaskModal({
  open, onClose, orgId, projectId, onCreated,
}: {
  open: boolean; onClose: () => void;
  orgId: string; projectId: string; onCreated: () => void;
}) {
  const [form, setForm] = useState({
    title: "", description: "", priority: "medium" as TaskPriority,
    due_date: "", estimated_hours: "", assign_to_me: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.title.trim()) { setError("Task title is required."); return; }
    setSaving(true); setError("");
    const { data: { user } } = await supabase.auth.getUser();
    const { error: err } = await supabase.from("tasks").insert({
      organization_id: orgId,
      project_id: projectId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      priority: form.priority,
      status: "todo",
      due_date: form.due_date || null,
      estimated_hours: form.estimated_hours ? parseFloat(form.estimated_hours) : null,
      assigned_to: form.assign_to_me ? user?.id : null,
      created_by: user?.id,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setForm({ title: "", description: "", priority: "medium", due_date: "", estimated_hours: "", assign_to_me: false });
    onCreated();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>New Task</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Title *</label>
            <Input placeholder="e.g. Submit RERA application" value={form.title}
              onChange={(e) => set("title", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[64px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Optional details…"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Priority</label>
              <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Due Date</label>
              <Input type="date" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Estimated Hours</label>
            <Input type="number" placeholder="e.g. 8" value={form.estimated_hours}
              onChange={(e) => set("estimated_hours", e.target.value)} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.assign_to_me}
              onChange={(e) => set("assign_to_me", e.target.checked)}
              className="rounded border-border"
            />
            <span className="text-sm text-foreground">Assign to me</span>
          </label>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={submit} disabled={saving}>
              {saving ? "Saving…" : "Create Task"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { orgId } = useOrgContext();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks]     = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateTask, setShowCreateTask] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [projRes, tasksRes] = await Promise.all([
      supabase.from("projects")
        .select("id,name,description,status,location,start_date,target_end_date,budget_lakhs,spent_lakhs")
        .eq("id", id).single(),
      supabase.from("tasks")
        .select("id,title,description,status,priority,due_date,assigned_to,estimated_hours,created_at")
        .eq("project_id", id)
        .order("created_at", { ascending: true }),
    ]);
    setProject(projRes.data as Project);
    setTasks((tasksRes.data as Task[]) ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const updateTaskStatus = async (taskId: string, status: TaskStatus) => {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status } : t));
    await supabase.from("tasks").update({ status }).eq("id", taskId);
  };

  if (loading) return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-48" />
      <div className="grid grid-cols-5 gap-4 mt-8">
        {[1,2,3,4,5].map(i=><Skeleton key={i} className="h-64 rounded-xl"/>)}
      </div>
    </div>
  );

  if (!project) return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <p className="text-muted-foreground">Project not found.</p>
    </div>
  );

  const pCfg = PROJECT_STATUS_CONFIG[project.status];
  const utilPct = project.budget_lakhs && project.spent_lakhs != null
    ? Math.min(Math.round((project.spent_lakhs / project.budget_lakhs) * 100), 100) : null;
  const totalTasks = tasks.length;
  const doneTasks  = tasks.filter((t) => t.status === "done").length;
  const completionPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Back */}
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors">
        <ArrowLeft className="w-4 h-4" />Projects
      </button>

      {/* Project header */}
      <div className="bg-surface border border-border rounded-xl p-5 mb-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-foreground">{project.name}</h1>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${pCfg.color}`}>{pCfg.label}</span>
            </div>
            {project.location && (
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />{project.location}
              </p>
            )}
            {project.description && (
              <p className="text-sm text-muted-foreground mt-2">{project.description}</p>
            )}
          </div>
          <Button onClick={() => setShowCreateTask(true)} className="gap-2 flex-shrink-0">
            <Plus className="w-4 h-4" />New Task
          </Button>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Metric label="Tasks" value={`${doneTasks}/${totalTasks}`} sub={`${completionPct}% done`} />
          {project.budget_lakhs && (
            <Metric
              label="Budget"
              value={`₹${project.spent_lakhs ?? 0}L`}
              sub={`of ₹${project.budget_lakhs}L (${utilPct ?? 0}%)`}
              warn={utilPct != null && utilPct >= 100}
            />
          )}
          {project.start_date && (
            <Metric label="Started" value={format(parseISO(project.start_date), "dd MMM yyyy")} />
          )}
          {project.target_end_date && (
            <Metric label="Target" value={format(parseISO(project.target_end_date), "dd MMM yyyy")} />
          )}
        </div>

        {/* Task completion bar */}
        {totalTasks > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Task completion</span>
              <span>{completionPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${completionPct}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Task Board */}
      <div className="overflow-x-auto">
        <div className="flex gap-4 min-w-max pb-4">
          {STATUS_COLUMNS.map(({ status, label, icon: Icon, color }) => {
            const col = tasks.filter((t) => t.status === status);
            return (
              <div key={status} className="w-64 flex-shrink-0">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <span className="text-sm font-semibold text-foreground">{label}</span>
                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{col.length}</span>
                </div>
                <div className="space-y-2 bg-muted/30 rounded-xl p-2 min-h-[120px]">
                  {col.map((task) => (
                    <TaskCard key={task.id} task={task} onStatusChange={updateTaskStatus} />
                  ))}
                  {col.length === 0 && (
                    <p className="text-center text-xs text-muted-foreground py-6">—</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {orgId && (
        <CreateTaskModal
          open={showCreateTask}
          onClose={() => setShowCreateTask(false)}
          orgId={orgId}
          projectId={id}
          onCreated={fetchAll}
        />
      )}
    </div>
  );
}

function Metric({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
        {warn && <AlertCircle className="w-3 h-3 text-red-500" />}{label}
      </p>
      <p className={`text-sm font-semibold ${warn ? "text-red-500" : "text-foreground"}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
