"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useOrgContext } from "@/lib/hooks/useOrgContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckSquare, AlertCircle, Calendar, Clock,
  Loader2, Eye, Ban, CheckCircle2, Circle, ExternalLink,
} from "lucide-react";
import { format, isPast, parseISO, isToday, isTomorrow } from "date-fns";

type TaskStatus   = "todo" | "in_progress" | "review" | "blocked" | "done";
type TaskPriority = "low" | "medium" | "high" | "urgent";

type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  estimated_hours: number | null;
  project_id: string | null;
  project_name: string | null;
  created_at: string;
};

const STATUS_CONFIG: Record<TaskStatus, { label: string; icon: React.ElementType; color: string }> = {
  todo:        { label: "To Do",      icon: Circle,       color: "text-gray-400" },
  in_progress: { label: "In Progress",icon: Loader2,      color: "text-blue-500" },
  review:      { label: "Review",     icon: Eye,          color: "text-purple-500" },
  blocked:     { label: "Blocked",    icon: Ban,          color: "text-red-500" },
  done:        { label: "Done",       icon: CheckCircle2, color: "text-green-500" },
};

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string }> = {
  low:    { label: "Low",    color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  medium: { label: "Medium", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  high:   { label: "High",   color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
  urgent: { label: "Urgent", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
};

function dueDateLabel(date: string | null): { label: string; color: string } | null {
  if (!date) return null;
  const d = parseISO(date);
  if (isPast(d) && !isToday(d)) return { label: `Overdue · ${format(d, "dd MMM")}`, color: "text-red-500 font-semibold" };
  if (isToday(d))               return { label: "Due today",                          color: "text-orange-500 font-semibold" };
  if (isTomorrow(d))            return { label: "Due tomorrow",                        color: "text-yellow-600 dark:text-yellow-400" };
  return                               { label: format(d, "dd MMM yyyy"),              color: "text-muted-foreground" };
}

const FILTER_OPTIONS = [
  { value: "all",         label: "All Tasks" },
  { value: "overdue",     label: "Overdue" },
  { value: "today",       label: "Due Today" },
  { value: "todo",        label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "review",      label: "Review" },
  { value: "blocked",     label: "Blocked" },
  { value: "done",        label: "Done" },
];

// ── Task Row ──────────────────────────────────────────────────
function TaskRow({ task, onStatusChange }: { task: Task; onStatusChange: (id: string, s: TaskStatus) => void }) {
  const sCfg = STATUS_CONFIG[task.status];
  const pCfg = PRIORITY_CONFIG[task.priority];
  const due  = dueDateLabel(task.due_date);
  const Icon = sCfg.icon;

  return (
    <div className="flex items-center gap-3 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors px-4 -mx-4 rounded-lg">
      <Icon className={`w-4 h-4 flex-shrink-0 ${sCfg.color}`} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-sm font-medium ${task.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>
            {task.title}
          </p>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${pCfg.color}`}>
            {pCfg.label}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {task.project_name && (
            <Link href={`/projects/${task.project_id}`}
              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors">
              <ExternalLink className="w-3 h-3" />{task.project_name}
            </Link>
          )}
          {due && (
            <span className={`text-xs flex items-center gap-1 ${due.color}`}>
              {isPast(parseISO(task.due_date!)) && !isToday(parseISO(task.due_date!))
                ? <AlertCircle className="w-3 h-3" />
                : <Calendar className="w-3 h-3" />}
              {due.label}
            </span>
          )}
          {task.estimated_hours && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />{task.estimated_hours}h
            </span>
          )}
        </div>
      </div>

      <Select value={task.status} onValueChange={(v) => onStatusChange(task.id, v as TaskStatus)}>
        <SelectTrigger className="h-7 text-xs w-[110px] border-border">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function TasksPage() {
  const { orgId, userId, loading: orgLoading } = useOrgContext();
  const [tasks, setTasks]   = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState("all");

  useEffect(() => {
    if (!orgLoading && !orgId) setLoading(false);
  }, [orgLoading, orgId]);

  const fetchTasks = useCallback(async () => {
    if (!orgId || !userId) return;
    setLoading(true);
    const { data } = await supabase
      .from("tasks")
      .select(`id,title,status,priority,due_date,estimated_hours,project_id,created_at,
        projects(name)`)
      .eq("organization_id", orgId)
      .eq("assigned_to", userId)
      .order("due_date", { ascending: true, nullsFirst: false });

    type TaskRow = Task & { projects: { name: string } | null };
    setTasks(
      ((data ?? []) as unknown as TaskRow[]).map((t) => ({
        ...t,
        project_name: t.projects?.name ?? null,
      }))
    );
    setLoading(false);
  }, [orgId, userId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const updateStatus = async (taskId: string, status: TaskStatus) => {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status } : t));
    await supabase.from("tasks").update({ status }).eq("id", taskId);
  };

  const filtered = tasks.filter((t) => {
    if (filter === "all")         return true;
    if (filter === "overdue")     return t.due_date && t.status !== "done" && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date));
    if (filter === "today")       return t.due_date && isToday(parseISO(t.due_date));
    return t.status === filter;
  });

  // Counts for filter badges
  const overdueCount = tasks.filter((t) =>
    t.due_date && t.status !== "done" && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date))
  ).length;
  const blockedCount = tasks.filter((t) => t.status === "blocked").length;

  // Group by project
  const grouped = filtered.reduce<Record<string, { name: string | null; tasks: Task[] }>>((acc, t) => {
    const key = t.project_id ?? "__none__";
    if (!acc[key]) acc[key] = { name: t.project_name, tasks: [] };
    acc[key].tasks.push(t);
    return acc;
  }, {});

  if (orgLoading) return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-3">
      {[1,2,3,4].map(i=><Skeleton key={i} className="h-16 rounded-lg"/>)}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Tasks</h1>
          <div className="flex items-center gap-3 mt-0.5">
            <p className="text-sm text-muted-foreground">{tasks.length} assigned to you</p>
            {overdueCount > 0 && (
              <span className="text-xs text-red-500 font-semibold flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />{overdueCount} overdue
              </span>
            )}
            {blockedCount > 0 && (
              <span className="text-xs text-orange-500 font-semibold flex items-center gap-1">
                <Ban className="w-3 h-3" />{blockedCount} blocked
              </span>
            )}
          </div>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FILTER_OPTIONS.map(({ value, label }) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Task list */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i=><Skeleton key={i} className="h-16 rounded-lg"/>)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <CheckSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">
            {filter === "all" ? "No tasks assigned to you" : "No tasks match this filter"}
          </p>
          {filter === "all" && (
            <p className="text-sm text-muted-foreground mt-1">
              Tasks appear here when assigned to you in a project.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([key, group]) => (
            <div key={key}>
              {/* Project header */}
              <div className="flex items-center gap-2 mb-2">
                {group.name ? (
                  <Link href={`/projects/${key}`}
                    className="text-xs font-semibold text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors">
                    <ExternalLink className="w-3 h-3" />{group.name}
                  </Link>
                ) : (
                  <span className="text-xs font-semibold text-muted-foreground">Unassigned</span>
                )}
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">{group.tasks.length}</span>
              </div>
              <div className="bg-surface border border-border rounded-xl px-4 py-1">
                {group.tasks.map((task) => (
                  <TaskRow key={task.id} task={task} onStatusChange={updateStatus} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
