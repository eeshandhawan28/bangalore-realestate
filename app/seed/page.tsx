"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { calculateValuation } from "@/lib/valuation";

// ─────────────────────────────────────────────────────────────
// Seed data definitions
// ─────────────────────────────────────────────────────────────

const SEED_PROPERTIES = [
  { name: "Koramangala Heights", location: "Koramangala", area_type: "Super built-up Area", total_sqft: 1850, bhk: 3, bathrooms: 3, balconies: 2, purchase_price_lakhs: 145, purchase_date: "2019-03-15", ownership_type: "self-occupied" as const, notes: "Corner unit on 8th floor. Gym and pool in society." },
  { name: "Whitefield Residency", location: "Whitefield", area_type: "Super built-up Area", total_sqft: 1240, bhk: 2, bathrooms: 2, balconies: 1, purchase_price_lakhs: 72, purchase_date: "2021-08-10", ownership_type: "rented" as const, notes: "Tenant paying ₹28k/month. Lease renewed until Dec 2025." },
  { name: "Indiranagar Villa", location: "Indiranagar", area_type: "Super built-up Area", total_sqft: 2600, bhk: 4, bathrooms: 4, balconies: 3, purchase_price_lakhs: 310, purchase_date: "2017-06-05", ownership_type: "self-occupied" as const, notes: "Duplex. Prime 100ft road location." },
];

const SEED_CONTACTS = [
  { type: "lead",       first_name: "Rajesh",    last_name: "Sharma",  company: null,                     email: "rajesh.sharma@gmail.com",  phone: "+91 98451 23456", city: "Bangalore", source: "MagicBricks",  tags: ["3BHK", "whitefield", "high-budget"] },
  { type: "lead",       first_name: "Meena",     last_name: "Reddy",   company: null,                     email: "meena.reddy@outlook.com",   phone: "+91 97124 56789", city: "Bangalore", source: "referral",     tags: ["rental", "koramangala"] },
  { type: "client",     first_name: "Priya",     last_name: "Nair",    company: null,                     email: "priya.nair@gmail.com",      phone: "+91 99001 88234", city: "Bangalore", source: "website",      tags: ["closed-deal", "Q1-2025"] },
  { type: "client",     first_name: "Vikram",    last_name: "Patel",   company: "Patel Holdings",         email: "vikram@patelholdings.in",   phone: "+91 98765 43210", city: "Bangalore", source: "referral",     tags: ["investor", "repeat-client"] },
  { type: "contractor", first_name: "Suresh",    last_name: null,      company: "Suresh Civil Works",     email: "suresh@civilworks.co",      phone: "+91 94481 22334", city: "Bangalore", source: "existing",     tags: ["civil", "trusted"] },
  { type: "vendor",     first_name: "BuildRight", last_name: null,     company: "BuildRight Materials",   email: "sales@buildright.com",      phone: "+91 80124 99001", city: "Bangalore", source: "expo",         tags: ["materials", "cement", "steel"] },
  { type: "investor",   first_name: "Arun",      last_name: "Kumar",   company: "AK Capital",            email: "arun@akcapital.in",         phone: "+91 98230 11456", city: "Mumbai",    source: "networking",   tags: ["land", "high-ticket"] },
  { type: "government", first_name: "BBMP",      last_name: null,      company: "Bruhat Bengaluru Mahanagara Palike", email: "permits@bbmp.gov.in", phone: "+91 80 2226 0000", city: "Bangalore", source: null, tags: ["permits", "noc"] },
];

const PIPELINE_STAGES = [
  { name: "Prospecting",  position: 1, color: "#94a3b8", win_probability: 10 },
  { name: "Proposal",     position: 2, color: "#6366f1", win_probability: 30 },
  { name: "Negotiation",  position: 3, color: "#f59e0b", win_probability: 60 },
  { name: "Closed Won",   position: 4, color: "#10b981", win_probability: 100 },
  { name: "Closed Lost",  position: 5, color: "#ef4444", win_probability: 0 },
];

const PROJECTS = [
  {
    name: "Prestige Elara — Phase 1",
    description: "48-unit residential project, 2 & 3 BHK apartments. RERA approved. Target handover Q4 2025.",
    status: "construction",
    location: "Whitefield, Bangalore",
    start_date: "2024-01-15",
    target_end_date: "2025-12-31",
    budget_lakhs: 850,
    spent_lakhs: 412,
    tags: ["residential", "RERA-approved", "Q4-2025"],
    tasks: [
      { title: "Submit RERA application & registration",   status: "done",        priority: "urgent", due_date: "2024-02-01", estimated_hours: 16 },
      { title: "Foundation & basement work",               status: "done",        priority: "high",   due_date: "2024-04-30", estimated_hours: 120 },
      { title: "Electrical wiring — Floors 1-4",          status: "in_progress", priority: "high",   due_date: "2025-06-15", estimated_hours: 80 },
      { title: "Plumbing installation — all floors",       status: "in_progress", priority: "high",   due_date: "2025-07-01", estimated_hours: 60 },
      { title: "Structural audit by certified engineer",   status: "review",      priority: "urgent", due_date: "2025-05-20", estimated_hours: 24 },
      { title: "Elevator shaft — awaiting KPTCL approval", status: "blocked",    priority: "high",   due_date: "2025-05-10", estimated_hours: 40 },
      { title: "Interior finishing & tiling",              status: "todo",        priority: "medium", due_date: "2025-09-30", estimated_hours: 200 },
      { title: "Landscaping & common areas",               status: "todo",        priority: "low",    due_date: "2025-11-15", estimated_hours: 48 },
    ],
  },
  {
    name: "HSR Township — Phase 2",
    description: "Mixed-use development — 120 plots + 24 commercial units. Land acquired. Environmental clearance in progress.",
    status: "planning",
    location: "HSR Layout, Bangalore",
    start_date: "2025-03-01",
    target_end_date: "2027-06-30",
    budget_lakhs: 1200,
    spent_lakhs: 95,
    tags: ["mixed-use", "township", "2027"],
    tasks: [
      { title: "Land acquisition — all parcels",           status: "done",        priority: "urgent", due_date: "2025-02-28", estimated_hours: 40 },
      { title: "Architectural drawings — master plan",     status: "in_progress", priority: "high",   due_date: "2025-06-30", estimated_hours: 120 },
      { title: "Environmental Impact Assessment",          status: "todo",        priority: "high",   due_date: "2025-08-01", estimated_hours: 60 },
      { title: "Soil testing & geo-technical report",      status: "todo",        priority: "medium", due_date: "2025-07-15", estimated_hours: 32 },
      { title: "NOC from municipality — zoning change",   status: "blocked",     priority: "urgent", due_date: "2025-05-01", estimated_hours: 20 },
    ],
  },
];

// ─────────────────────────────────────────────────────────────

type Step = { label: string; done: boolean; error?: string };

export default function SeedPage() {
  const [running, setRunning]   = useState(false);
  const [done, setDone]         = useState(false);
  const [steps, setSteps]       = useState<Step[]>([]);
  const [error, setError]       = useState("");

  function addStep(label: string, err?: string) {
    setSteps((s) => [...s, { label, done: true, error: err }]);
  }

  const runSeed = async () => {
    setRunning(true);
    setSteps([]);
    setError("");

    // ── 1. Auth ───────────────────────────────────────────────
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Not signed in. Please go to /login first.");
      setRunning(false);
      return;
    }
    addStep(`Authenticated as ${user.email}`);

    // ── 2. Org ────────────────────────────────────────────────
    let orgId: string;
    const { data: existingMembership } = await supabase
      .from("org_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (existingMembership?.organization_id) {
      orgId = existingMembership.organization_id;
      addStep("Organisation found ✓");
    } else {
      // Create org + membership
      const { data: newOrg, error: orgErr } = await supabase
        .from("organizations")
        .insert({ name: "Acme Builders Pvt Ltd", slug: `acme-${user.id.slice(0,8)}`, tier: "pro", locale: "en" })
        .select("id")
        .single();
      if (orgErr || !newOrg) {
        setError(`Could not create org: ${orgErr?.message}`);
        setRunning(false);
        return;
      }
      orgId = newOrg.id;
      await supabase.from("org_members").insert({ organization_id: orgId, user_id: user.id, role: "owner" });
      addStep("Created organisation: Acme Builders Pvt Ltd");
    }

    // ── 3. Portfolio properties ───────────────────────────────
    const { count: existingProps } = await supabase
      .from("properties").select("id", { count: "exact", head: true }).eq("user_id", user.id);
    if ((existingProps ?? 0) === 0) {
      const rows = SEED_PROPERTIES.map((p) => {
        const val = calculateValuation({ location: p.location, area_type: p.area_type, total_sqft: p.total_sqft, bhk: p.bhk, bathrooms: p.bathrooms, balconies: p.balconies });
        return { ...p, user_id: user.id, ai_estimated_value_lakhs: val.predicted_price_lakhs };
      });
      await supabase.from("properties").insert(rows);
      addStep(`Seeded ${rows.length} portfolio properties`);
    } else {
      addStep("Portfolio properties already exist — skipped");
    }

    // ── 4. Contacts ───────────────────────────────────────────
    const { count: existingContacts } = await supabase
      .from("contacts").select("id", { count: "exact", head: true }).eq("organization_id", orgId);
    let contactIds: string[] = [];
    if ((existingContacts ?? 0) === 0) {
      const rows = SEED_CONTACTS.map((c) => ({
        ...c, organization_id: orgId, assigned_to: user.id, created_by: user.id,
      }));
      const { data: inserted } = await supabase.from("contacts").insert(rows).select("id");
      contactIds = inserted?.map((r: { id: string }) => r.id) ?? [];
      addStep(`Seeded ${contactIds.length} contacts`);
    } else {
      const { data: existing } = await supabase.from("contacts").select("id").eq("organization_id", orgId).limit(8);
      contactIds = existing?.map((r: { id: string }) => r.id) ?? [];
      addStep("Contacts already exist — skipped");
    }

    // ── 5. Pipeline ───────────────────────────────────────────
    let pipelineId: string;
    let stageIds: Record<string, string> = {}; // name → id

    const { data: existingPipeline } = await supabase
      .from("pipelines").select("id").eq("organization_id", orgId).eq("is_default", true).limit(1).single();

    if (existingPipeline) {
      pipelineId = existingPipeline.id;
      const { data: stageRows } = await supabase.from("pipeline_stages").select("id,name").eq("pipeline_id", pipelineId);
      stageIds = Object.fromEntries((stageRows ?? []).map((s: { id: string; name: string }) => [s.name, s.id]));
      addStep("Pipeline already exists — skipped");
    } else {
      const { data: newPipeline } = await supabase
        .from("pipelines")
        .insert({ organization_id: orgId, name: "Sales Pipeline", is_default: true, created_by: user.id })
        .select("id").single();
      pipelineId = newPipeline!.id;

      const stageRows = PIPELINE_STAGES.map((s) => ({ ...s, pipeline_id: pipelineId }));
      const { data: insertedStages } = await supabase.from("pipeline_stages").insert(stageRows).select("id,name");
      stageIds = Object.fromEntries((insertedStages ?? []).map((s: { id: string; name: string }) => [s.name, s.id]));
      addStep("Created Sales Pipeline with 5 stages");
    }

    // ── 6. Deals ──────────────────────────────────────────────
    const { count: existingDeals } = await supabase
      .from("deals").select("id", { count: "exact", head: true }).eq("organization_id", orgId);
    if ((existingDeals ?? 0) === 0 && Object.keys(stageIds).length > 0) {
      const dealDefs = [
        { title: "3BHK Sale — Whitefield",       stage: "Proposal",     value: 95,  prob: 30,  close: "2025-07-30", cIdx: 0 },
        { title: "Rental — Koramangala 2BHK",    stage: "Prospecting",  value: 45,  prob: 10,  close: "2025-06-15", cIdx: 1 },
        { title: "Plot purchase — Sarjapur",      stage: "Negotiation",  value: 180, prob: 60,  close: "2025-08-01", cIdx: 3 },
        { title: "Corporate lease — Hebbal",      stage: "Closed Won",   value: 120, prob: 100, close: "2025-04-30", cIdx: 2 },
        { title: "4BHK Sale — HSR Layout",        stage: "Closed Lost",  value: 220, prob: 0,   close: "2025-03-31", cIdx: 1 },
        { title: "Villa plot — Devanahalli",      stage: "Prospecting",  value: 150, prob: 10,  close: "2025-09-30", cIdx: 6 },
      ];
      const dealRows = dealDefs.map((d) => ({
        organization_id: orgId,
        pipeline_id: pipelineId,
        stage_id: stageIds[d.stage] ?? Object.values(stageIds)[0],
        title: d.title,
        value_lakhs: d.value,
        probability: d.prob,
        expected_close: d.close,
        contact_id: contactIds[d.cIdx] ?? null,
        assigned_to: user.id,
        created_by: user.id,
      }));
      await supabase.from("deals").insert(dealRows);
      addStep(`Seeded ${dealRows.length} deals across pipeline stages`);
    } else {
      addStep("Deals already exist — skipped");
    }

    // ── 7. Projects + Tasks ───────────────────────────────────
    const { count: existingProjects } = await supabase
      .from("projects").select("id", { count: "exact", head: true }).eq("organization_id", orgId);
    if ((existingProjects ?? 0) === 0) {
      for (const proj of PROJECTS) {
        const { tasks, ...projData } = proj;
        const { data: newProj } = await supabase
          .from("projects")
          .insert({ ...projData, organization_id: orgId, created_by: user.id })
          .select("id").single();
        if (!newProj) continue;

        const taskRows = tasks.map((t) => ({
          ...t,
          organization_id: orgId,
          project_id: newProj.id,
          assigned_to: user.id,
          created_by: user.id,
        }));
        await supabase.from("tasks").insert(taskRows);
      }
      addStep(`Seeded ${PROJECTS.length} projects with ${PROJECTS.reduce((s, p) => s + p.tasks.length, 0)} tasks`);
    } else {
      addStep("Projects already exist — skipped");
    }

    setDone(true);
    setRunning(false);
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-12 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Seed Demo Data</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Populates your account with realistic demo data — contacts, pipeline deals, projects & tasks — so you can explore the full PropIQ experience.
        </p>
      </div>

      {!done && (
        <div className="bg-muted/40 border border-border rounded-xl p-4 text-sm text-muted-foreground space-y-1">
          <p className="font-medium text-foreground mb-2">What gets seeded:</p>
          <p>📋 3 portfolio properties (Koramangala, Whitefield, Indiranagar)</p>
          <p>👥 8 contacts (leads, clients, contractor, vendor, investor)</p>
          <p>🏷️ Sales pipeline with 6 deals across 5 stages</p>
          <p>🏗️ 2 projects (construction + planning phase)</p>
          <p>✅ 13 tasks assigned to you (mix of statuses)</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl p-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {steps.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-4 space-y-2">
          {steps.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="text-green-500 mt-0.5">✓</span>
              <span className={s.error ? "text-red-500" : "text-foreground"}>{s.label}</span>
            </div>
          ))}
          {running && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="inline-block w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              Running…
            </div>
          )}
        </div>
      )}

      {done && (
        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-xl p-4 text-sm text-green-700 dark:text-green-400 font-medium">
          All done! Your demo data is ready.
        </div>
      )}

      <div className="flex gap-3">
        <Button
          onClick={runSeed}
          disabled={running || done}
          className="flex-1"
        >
          {running ? "Seeding…" : done ? "Done ✓" : "Seed Demo Data"}
        </Button>
        {done && (
          <div className="flex gap-2 flex-1">
            <a href="/contacts" className="flex-1 text-center text-sm bg-muted hover:bg-muted/80 text-foreground px-3 py-2 rounded-lg transition-colors border border-border">Contacts</a>
            <a href="/pipeline" className="flex-1 text-center text-sm bg-muted hover:bg-muted/80 text-foreground px-3 py-2 rounded-lg transition-colors border border-border">Pipeline</a>
            <a href="/projects" className="flex-1 text-center text-sm bg-muted hover:bg-muted/80 text-foreground px-3 py-2 rounded-lg transition-colors border border-border">Projects</a>
          </div>
        )}
      </div>
    </div>
  );
}
