-- ============================================================
-- Migration 003: Project Management Tables
-- ============================================================

-- Templates (referenced by projects)
CREATE TABLE IF NOT EXISTS templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  category        TEXT NOT NULL DEFAULT 'project'
                  CHECK (category IN ('project','workflow','report','checklist','pipeline','budget')),
  is_system       BOOLEAN DEFAULT false,
  is_public       BOOLEAN DEFAULT false,
  content         JSONB NOT NULL DEFAULT '{}'::jsonb,
  locale          TEXT DEFAULT 'en',
  version         INT DEFAULT 1,
  generated_from  TEXT CHECK (generated_from IN ('voice','text','manual','ai')),
  original_prompt TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'planning'
                  CHECK (status IN ('pre_development','planning','procurement','construction','closeout','completed','on_hold')),
  location        TEXT,
  latitude        NUMERIC,
  longitude       NUMERIC,
  start_date      DATE,
  target_end_date DATE,
  actual_end_date DATE,
  budget_lakhs    NUMERIC,
  spent_lakhs     NUMERIC DEFAULT 0,
  template_id     UUID REFERENCES templates(id) ON DELETE SET NULL,
  tags            TEXT[] DEFAULT '{}',
  custom_fields   JSONB DEFAULT '{}'::jsonb,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  parent_task_id  UUID REFERENCES tasks(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'todo'
                  CHECK (status IN ('todo','in_progress','review','blocked','done')),
  priority        TEXT NOT NULL DEFAULT 'medium'
                  CHECK (priority IN ('low','medium','high','urgent')),
  assigned_to     UUID REFERENCES auth.users(id),
  due_date        DATE,
  start_date      DATE,
  completed_at    TIMESTAMPTZ,
  estimated_hours NUMERIC,
  actual_hours    NUMERIC,
  position        INT DEFAULT 0,
  dependencies    UUID[] DEFAULT '{}',
  tags            TEXT[] DEFAULT '{}',
  attachments     JSONB DEFAULT '[]'::jsonb,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Task Comments
CREATE TABLE IF NOT EXISTS task_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type            TEXT NOT NULL DEFAULT 'task_assigned'
                  CHECK (type IN (
                    'deal_alert','task_assigned','task_due','budget_alert',
                    'pipeline_update','document_uploaded','workflow_completed',
                    'ai_insight','mention'
                  )),
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  link            TEXT,
  metadata        JSONB DEFAULT '{}'::jsonb,
  is_read         BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_templates_org      ON templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category, is_system);
CREATE INDEX IF NOT EXISTS idx_projects_org       ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_status    ON projects(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_org          ON tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project      ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned     ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status       ON tasks(project_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_due          ON tasks(due_date) WHERE status != 'done';
CREATE INDEX IF NOT EXISTS idx_task_comments      ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE templates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications  ENABLE ROW LEVEL SECURITY;

-- Templates: system templates visible to all; org templates to members
CREATE POLICY "anyone_can_view_system_templates"
  ON templates FOR SELECT
  USING (is_system = true OR is_public = true OR organization_id IS NULL OR is_org_member(organization_id));

CREATE POLICY "org_members_create_templates"
  ON templates FOR INSERT
  WITH CHECK (organization_id IS NULL OR is_org_member(organization_id));

CREATE POLICY "org_members_update_templates"
  ON templates FOR UPDATE
  USING (organization_id IS NULL OR is_org_member(organization_id));

CREATE POLICY "org_managers_delete_templates"
  ON templates FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM org_members
      WHERE user_id = auth.uid() AND role IN ('owner','manager')
    )
  );

-- Projects
CREATE POLICY "org_members_view_projects"
  ON projects FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "org_members_create_projects"
  ON projects FOR INSERT WITH CHECK (is_org_member(organization_id));

CREATE POLICY "org_members_update_projects"
  ON projects FOR UPDATE USING (is_org_member(organization_id));

CREATE POLICY "org_managers_delete_projects"
  ON projects FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM org_members
      WHERE user_id = auth.uid() AND role IN ('owner','manager')
    )
  );

-- Tasks: members can view all; can update own assigned tasks
CREATE POLICY "org_members_view_tasks"
  ON tasks FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "org_members_create_tasks"
  ON tasks FOR INSERT WITH CHECK (is_org_member(organization_id));

CREATE POLICY "org_members_update_tasks"
  ON tasks FOR UPDATE
  USING (
    is_org_member(organization_id) AND (
      assigned_to = auth.uid() OR
      organization_id IN (
        SELECT organization_id FROM org_members
        WHERE user_id = auth.uid() AND role IN ('owner','manager')
      )
    )
  );

CREATE POLICY "org_managers_delete_tasks"
  ON tasks FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM org_members
      WHERE user_id = auth.uid() AND role IN ('owner','manager')
    )
  );

-- Task comments
CREATE POLICY "org_members_view_task_comments"
  ON task_comments FOR SELECT
  USING (
    task_id IN (SELECT id FROM tasks WHERE is_org_member(organization_id))
  );

CREATE POLICY "org_members_create_task_comments"
  ON task_comments FOR INSERT
  WITH CHECK (
    task_id IN (SELECT id FROM tasks WHERE is_org_member(organization_id))
  );

-- Notifications: own notifications only
CREATE POLICY "users_view_own_notifications"
  ON notifications FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_update_own_notifications"
  ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- ── Seed system templates ─────────────────────────────────────
INSERT INTO templates (name, description, category, is_system, is_public, content) VALUES
(
  'Residential Construction',
  'Standard template for a residential building project with 6 phases covering design to handover',
  'project',
  true,
  true,
  '{
    "estimated_duration_days": 365,
    "phases": [
      {
        "name": "Pre-Development",
        "duration_days": 30,
        "tasks": [
          {"title": "Site survey & soil testing", "duration_days": 5, "priority": "high", "role": "manager"},
          {"title": "Legal & title verification", "duration_days": 10, "priority": "high", "role": "manager"},
          {"title": "RERA registration", "duration_days": 15, "priority": "high", "role": "manager"},
          {"title": "Architectural brief preparation", "duration_days": 7, "priority": "medium", "role": "manager"}
        ]
      },
      {
        "name": "Planning & Design",
        "duration_days": 60,
        "tasks": [
          {"title": "Architectural drawings", "duration_days": 20, "priority": "high", "role": "contractor"},
          {"title": "Structural design", "duration_days": 15, "priority": "high", "role": "contractor"},
          {"title": "MEP design (electrical, plumbing)", "duration_days": 15, "priority": "high", "role": "contractor"},
          {"title": "Building plan approval (BBMP/BDA)", "duration_days": 30, "priority": "urgent", "role": "manager"},
          {"title": "Environmental clearance", "duration_days": 20, "priority": "high", "role": "manager"}
        ]
      },
      {
        "name": "Procurement",
        "duration_days": 45,
        "tasks": [
          {"title": "Main contractor tender & award", "duration_days": 20, "priority": "high", "role": "manager"},
          {"title": "Material procurement (cement, steel, bricks)", "duration_days": 15, "priority": "high", "role": "contractor"},
          {"title": "Electrical contractor selection", "duration_days": 10, "priority": "medium", "role": "manager"},
          {"title": "Plumbing contractor selection", "duration_days": 10, "priority": "medium", "role": "manager"}
        ]
      },
      {
        "name": "Foundation & Structure",
        "duration_days": 90,
        "tasks": [
          {"title": "Site clearing & excavation", "duration_days": 10, "priority": "high", "role": "field_worker"},
          {"title": "Foundation / pile work", "duration_days": 20, "priority": "urgent", "role": "contractor"},
          {"title": "Ground floor slab", "duration_days": 15, "priority": "high", "role": "contractor"},
          {"title": "Column & beam casting (per floor)", "duration_days": 30, "priority": "high", "role": "contractor"},
          {"title": "Brickwork & masonry", "duration_days": 25, "priority": "medium", "role": "field_worker"},
          {"title": "Quality inspection — structure", "duration_days": 5, "priority": "high", "role": "manager"}
        ]
      },
      {
        "name": "Finishing",
        "duration_days": 120,
        "tasks": [
          {"title": "Plastering (internal & external)", "duration_days": 25, "priority": "medium", "role": "contractor"},
          {"title": "Electrical wiring & fixtures", "duration_days": 20, "priority": "high", "role": "contractor"},
          {"title": "Plumbing & sanitation", "duration_days": 20, "priority": "high", "role": "contractor"},
          {"title": "Flooring", "duration_days": 15, "priority": "medium", "role": "contractor"},
          {"title": "Painting", "duration_days": 15, "priority": "low", "role": "contractor"},
          {"title": "Doors, windows & glazing", "duration_days": 10, "priority": "medium", "role": "contractor"},
          {"title": "Fire safety systems", "duration_days": 10, "priority": "urgent", "role": "contractor"},
          {"title": "Lift installation", "duration_days": 15, "priority": "high", "role": "contractor"}
        ]
      },
      {
        "name": "Closeout & Handover",
        "duration_days": 20,
        "tasks": [
          {"title": "Occupation certificate (OC)", "duration_days": 10, "priority": "urgent", "role": "manager"},
          {"title": "Snagging & defect rectification", "duration_days": 7, "priority": "high", "role": "field_worker"},
          {"title": "Utility connections (EB, water, gas)", "duration_days": 7, "priority": "high", "role": "manager"},
          {"title": "Handover to buyers", "duration_days": 5, "priority": "high", "role": "manager"}
        ]
      }
    ]
  }'::jsonb
),
(
  'RERA Compliance Checklist',
  'Mandatory compliance checklist for RERA registration and ongoing compliance in Karnataka',
  'checklist',
  true,
  true,
  '{
    "items": [
      {"text": "Project land ownership documents verified", "required": true},
      {"text": "Encumbrance certificate obtained", "required": true},
      {"text": "RERA application submitted on K-RERA portal", "required": true},
      {"text": "Project brochure registered with RERA", "required": true},
      {"text": "Escrow account opened (70% of collections)", "required": true},
      {"text": "Architect certificate for each phase submitted", "required": true},
      {"text": "Quarterly project status updates filed", "required": true},
      {"text": "Allotment letters as per RERA format issued", "required": true},
      {"text": "Sale agreement as per RERA format used", "required": true},
      {"text": "Possession certificate issued on time", "required": false},
      {"text": "Annual audit report filed", "required": true},
      {"text": "Defect liability period (5 years) tracking active", "required": false}
    ]
  }'::jsonb
),
(
  'Vendor Procurement Workflow',
  'Standard workflow for vendor selection, negotiation and contract award',
  'workflow',
  true,
  true,
  '{
    "trigger": {"type": "manual"},
    "conditions": [],
    "actions": [
      {"type": "create_task", "config": {"title": "Prepare RFQ document", "priority": "high"}},
      {"type": "create_task", "config": {"title": "Send RFQ to shortlisted vendors (min 3)", "priority": "high"}},
      {"type": "create_task", "config": {"title": "Collect & compare quotations", "priority": "high"}},
      {"type": "create_task", "config": {"title": "Technical evaluation of vendors", "priority": "medium"}},
      {"type": "create_task", "config": {"title": "Commercial negotiation", "priority": "high"}},
      {"type": "create_task", "config": {"title": "Reference check for selected vendor", "priority": "medium"}},
      {"type": "create_task", "config": {"title": "Draft & review contract", "priority": "urgent"}},
      {"type": "create_task", "config": {"title": "Sign contract & issue work order", "priority": "urgent"}}
    ]
  }'::jsonb
)
ON CONFLICT DO NOTHING;
