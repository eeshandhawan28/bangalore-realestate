import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseClient } from "@supabase/supabase-js";

export function createPmTools(supabase: SupabaseClient, organizationId: string) {
  const listProjects = new DynamicStructuredTool({
    name: "list_projects",
    description: "List real estate development projects. Can filter by status or search by name.",
    schema: z.object({
      status: z.enum(["pre_development","planning","procurement","construction","closeout","completed","on_hold"]).optional(),
      limit:  z.number().optional().default(10),
    }),
    async func({ status, limit }) {
      let q = supabase.from("projects")
        .select("id,name,description,status,location,start_date,target_end_date,budget_lakhs,spent_lakhs,tags,created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(limit ?? 10);
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) return `Error: ${error.message}`;
      if (!data || data.length === 0) return "No projects found.";
      return JSON.stringify(data.map((p) => ({
        ...p,
        budget_utilization_pct: p.budget_lakhs
          ? Math.round(((p.spent_lakhs ?? 0) / p.budget_lakhs) * 100) : null,
      })), null, 2);
    },
  });

  const createProject = new DynamicStructuredTool({
    name: "create_project",
    description: "Create a new real estate development project.",
    schema: z.object({
      name:            z.string().describe("Project name, e.g. 'Prestige Park — Phase 2'"),
      description:     z.string().optional(),
      status:          z.enum(["pre_development","planning","procurement","construction","closeout","on_hold"]).optional().default("planning"),
      location:        z.string().optional().describe("Locality or site address"),
      start_date:      z.string().optional().describe("Start date (YYYY-MM-DD)"),
      target_end_date: z.string().optional().describe("Target completion date (YYYY-MM-DD)"),
      budget_lakhs:    z.number().optional(),
      tags:            z.array(z.string()).optional(),
    }),
    async func({ name, description, status, location, start_date, target_end_date, budget_lakhs, tags }) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return "User is not authenticated.";
      const { data, error } = await supabase.from("projects").insert({
        organization_id: organizationId,
        name, description, status, location, budget_lakhs,
        start_date: start_date ?? null,
        target_end_date: target_end_date ?? null,
        tags: tags ?? [],
        created_by: user.id,
      }).select("id,name,status").single();
      if (error) return `Error: ${error.message}`;
      return JSON.stringify({ success: true, project_id: data.id, name: data.name,
        status: data.status, message: `Project "${data.name}" created.` }, null, 2);
    },
  });

  const updateProjectStatus = new DynamicStructuredTool({
    name: "update_project_status",
    description: "Move a project to a new lifecycle status (e.g. from planning to procurement).",
    schema: z.object({
      project_id: z.string(),
      status:     z.enum(["pre_development","planning","procurement","construction","closeout","completed","on_hold"]),
    }),
    async func({ project_id, status }) {
      const { data, error } = await supabase.from("projects")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", project_id).eq("organization_id", organizationId)
        .select("name,status").single();
      if (error) return `Error: ${error.message}`;
      return JSON.stringify({ success: true, project_id, name: data.name,
        new_status: data.status, message: `"${data.name}" is now in ${data.status}.` }, null, 2);
    },
  });

  const listTasks = new DynamicStructuredTool({
    name: "list_tasks",
    description: "List tasks for a project or all tasks assigned to the current user.",
    schema: z.object({
      project_id:     z.string().optional(),
      status:         z.enum(["todo","in_progress","review","blocked","done"]).optional(),
      assigned_to_me: z.boolean().optional().describe("If true, return only my tasks"),
      overdue_only:   z.boolean().optional(),
      limit:          z.number().optional().default(15),
    }),
    async func({ project_id, status, assigned_to_me, overdue_only, limit }) {
      const { data: { user } } = await supabase.auth.getUser();
      let q = supabase.from("tasks")
        .select("id,title,status,priority,assigned_to,due_date,project_id,projects(name)")
        .eq("organization_id", organizationId)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(limit ?? 15);

      if (project_id) q = q.eq("project_id", project_id);
      if (status)     q = q.eq("status", status);
      if (assigned_to_me && user) q = q.eq("assigned_to", user.id);
      if (overdue_only) q = q.lt("due_date", new Date().toISOString().split("T")[0]).neq("status", "done");

      const { data, error } = await q;
      if (error) return `Error: ${error.message}`;
      if (!data || data.length === 0) return "No tasks found.";
      return JSON.stringify(data, null, 2);
    },
  });

  const createTask = new DynamicStructuredTool({
    name: "create_task",
    description: "Create a new task in a project and optionally assign it to a team member.",
    schema: z.object({
      title:           z.string(),
      project_id:      z.string().optional(),
      description:     z.string().optional(),
      priority:        z.enum(["low","medium","high","urgent"]).optional().default("medium"),
      due_date:        z.string().optional().describe("Due date (YYYY-MM-DD)"),
      assign_to_me:    z.boolean().optional().describe("If true, assign the task to the current user"),
      estimated_hours: z.number().optional(),
    }),
    async func({ title, project_id, description, priority, due_date, assign_to_me, estimated_hours }) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return "User is not authenticated.";
      const { data, error } = await supabase.from("tasks").insert({
        organization_id: organizationId,
        title, project_id: project_id ?? null, description,
        priority: priority ?? "medium",
        due_date: due_date ?? null,
        assigned_to: assign_to_me ? user.id : null,
        estimated_hours: estimated_hours ?? null,
        status: "todo",
        created_by: user.id,
      }).select("id,title,status,priority").single();
      if (error) return `Error: ${error.message}`;
      return JSON.stringify({ success: true, task_id: data.id, title: data.title,
        priority: data.priority, message: `Task "${data.title}" created.` }, null, 2);
    },
  });

  const updateTask = new DynamicStructuredTool({
    name: "update_task",
    description: "Update a task's status, priority, due date, or add a note.",
    schema: z.object({
      task_id:        z.string(),
      status:         z.enum(["todo","in_progress","review","blocked","done"]).optional(),
      priority:       z.enum(["low","medium","high","urgent"]).optional(),
      due_date:       z.string().optional(),
      actual_hours:   z.number().optional(),
    }),
    async func({ task_id, status, priority, due_date, actual_hours }) {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (status)       { updates.status = status; if (status === "done") updates.completed_at = new Date().toISOString(); }
      if (priority)     updates.priority = priority;
      if (due_date)     updates.due_date = due_date;
      if (actual_hours) updates.actual_hours = actual_hours;

      const { data, error } = await supabase.from("tasks").update(updates)
        .eq("id", task_id).select("title,status").single();
      if (error) return `Error: ${error.message}`;
      return JSON.stringify({ success: true, task_id, title: data.title,
        new_status: data.status, message: `Task "${data.title}" updated.` }, null, 2);
    },
  });

  const getProjectTimeline = new DynamicStructuredTool({
    name: "get_project_timeline",
    description: "Returns a timeline summary for a project: phases, task counts by status, and critical path indicators.",
    schema: z.object({
      project_id: z.string(),
    }),
    async func({ project_id }) {
      const { data: project } = await supabase.from("projects")
        .select("name,status,start_date,target_end_date,budget_lakhs,spent_lakhs").eq("id", project_id).single();
      if (!project) return `Project not found.`;

      const { data: tasks } = await supabase.from("tasks")
        .select("status,priority,due_date,title").eq("project_id", project_id);

      const counts = { todo: 0, in_progress: 0, review: 0, blocked: 0, done: 0 };
      let overdue = 0;
      const today = new Date().toISOString().split("T")[0];

      for (const t of tasks ?? []) {
        counts[t.status as keyof typeof counts]++;
        if (t.due_date && t.due_date < today && t.status !== "done") overdue++;
      }

      const total = (tasks ?? []).length;
      const completion_pct = total > 0 ? Math.round((counts.done / total) * 100) : 0;
      const blocked_tasks  = (tasks ?? []).filter((t) => t.status === "blocked").map((t) => t.title);

      return JSON.stringify({
        project: project.name,
        status: project.status,
        timeline: { start: project.start_date, target_end: project.target_end_date },
        budget: {
          total_lakhs: project.budget_lakhs,
          spent_lakhs: project.spent_lakhs,
          utilization_pct: project.budget_lakhs
            ? Math.round(((project.spent_lakhs ?? 0) / project.budget_lakhs) * 100) : null,
        },
        tasks: { total, completion_pct, by_status: counts, overdue, blocked: blocked_tasks },
      }, null, 2);
    },
  });

  const getOverdueAlerts = new DynamicStructuredTool({
    name: "get_overdue_alerts",
    description: "Returns overdue and blocked tasks across all active projects in the organization.",
    schema: z.object({}),
    async func() {
      const today = new Date().toISOString().split("T")[0];
      const { data: overdue } = await supabase.from("tasks")
        .select("id,title,status,priority,due_date,assigned_to,projects(name)")
        .eq("organization_id", organizationId)
        .lt("due_date", today).neq("status", "done").order("due_date").limit(20);

      const { data: blocked } = await supabase.from("tasks")
        .select("id,title,priority,due_date,projects(name)")
        .eq("organization_id", organizationId)
        .eq("status", "blocked").limit(10);

      return JSON.stringify({
        overdue_count: overdue?.length ?? 0,
        blocked_count: blocked?.length ?? 0,
        overdue_tasks: overdue ?? [],
        blocked_tasks: blocked ?? [],
        summary: `${overdue?.length ?? 0} overdue, ${blocked?.length ?? 0} blocked tasks require attention.`,
      }, null, 2);
    },
  });

  return [listProjects, createProject, updateProjectStatus, listTasks, createTask, updateTask, getProjectTimeline, getOverdueAlerts];
}
