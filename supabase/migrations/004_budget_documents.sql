
-- ============================================================
-- Migration 004: Budget Tracking + Documents + AI Log
-- ============================================================

-- Budget Categories (hierarchical)
CREATE TABLE IF NOT EXISTS budget_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  planned_lakhs NUMERIC NOT NULL DEFAULT 0,
  parent_id     UUID REFERENCES budget_categories(id) ON DELETE SET NULL
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category_id       UUID REFERENCES budget_categories(id) ON DELETE SET NULL,
  description       TEXT NOT NULL,
  amount_lakhs      NUMERIC NOT NULL,
  vendor_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  date              DATE NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','paid','rejected')),
  approved_by       UUID REFERENCES auth.users(id),
  created_by        UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
  deal_id         UUID REFERENCES deals(id) ON DELETE SET NULL,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'other'
                  CHECK (type IN ('contract','permit','approval','invoice','report','template','other')),
  storage_path    TEXT NOT NULL,
  file_size       BIGINT,
  mime_type       TEXT,
  ai_summary      TEXT,
  ai_extracted    JSONB,
  version         INT DEFAULT 1,
  tags            TEXT[] DEFAULT '{}',
  uploaded_by     UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Workflow definitions
CREATE TABLE IF NOT EXISTS workflows (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_id     UUID REFERENCES templates(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  trigger_type    TEXT NOT NULL DEFAULT 'manual'
                  CHECK (trigger_type IN ('manual','schedule','event','webhook')),
  trigger_config  JSONB NOT NULL DEFAULT '{}'::jsonb,
  conditions      JSONB DEFAULT '[]'::jsonb,
  actions         JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active       BOOLEAN DEFAULT true,
  last_run_at     TIMESTAMPTZ,
  run_count       INT DEFAULT 0,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Workflow run history
CREATE TABLE IF NOT EXISTS workflow_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id  UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'running'
               CHECK (status IN ('running','completed','failed','cancelled')),
  trigger_data JSONB,
  result       JSONB,
  error        TEXT,
  started_at   TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- AI interaction log (usage tracking + debugging)
CREATE TABLE IF NOT EXISTS ai_interactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id      TEXT,
  agent_type      TEXT NOT NULL DEFAULT 'supervisor',
  input_text      TEXT,
  input_locale    TEXT DEFAULT 'en',
  input_source    TEXT DEFAULT 'text' CHECK (input_source IN ('text','voice')),
  output_text     TEXT,
  tools_used      TEXT[] DEFAULT '{}',
  tokens_used     INT,
  duration_ms     INT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_budget_categories_project ON budget_categories(project_id);
CREATE INDEX IF NOT EXISTS idx_expenses_project           ON expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_expenses_org               ON expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_org              ON documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_project          ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_workflows_org              ON workflows(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_workflow_runs              ON workflow_runs(workflow_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_org        ON ai_interactions(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_user       ON ai_interactions(user_id, created_at DESC);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows         ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_runs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_interactions   ENABLE ROW LEVEL SECURITY;

-- Budget categories
CREATE POLICY "org_members_view_budget_categories"
  ON budget_categories FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE is_org_member(organization_id)));

CREATE POLICY "org_members_manage_budget_categories"
  ON budget_categories FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE is_org_member(organization_id)));

-- Expenses
CREATE POLICY "org_members_view_expenses"
  ON expenses FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "org_members_create_expenses"
  ON expenses FOR INSERT WITH CHECK (is_org_member(organization_id));

CREATE POLICY "org_managers_update_expenses"
  ON expenses FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM org_members
      WHERE user_id = auth.uid() AND role IN ('owner','manager')
    )
  );

-- Documents
CREATE POLICY "org_members_view_documents"
  ON documents FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "org_members_upload_documents"
  ON documents FOR INSERT WITH CHECK (is_org_member(organization_id));

CREATE POLICY "org_members_update_documents"
  ON documents FOR UPDATE USING (is_org_member(organization_id));

CREATE POLICY "org_managers_delete_documents"
  ON documents FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM org_members
      WHERE user_id = auth.uid() AND role IN ('owner','manager')
    )
  );

-- Workflows
CREATE POLICY "org_members_view_workflows"
  ON workflows FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "org_managers_manage_workflows"
  ON workflows FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM org_members
      WHERE user_id = auth.uid() AND role IN ('owner','manager')
    )
  );

-- Workflow runs
CREATE POLICY "org_members_view_workflow_runs"
  ON workflow_runs FOR SELECT
  USING (workflow_id IN (SELECT id FROM workflows WHERE is_org_member(organization_id)));

-- AI interactions: own records only
CREATE POLICY "users_view_own_ai_interactions"
  ON ai_interactions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_create_ai_interactions"
  ON ai_interactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── Function: update project spent_lakhs on expense change ───
CREATE OR REPLACE FUNCTION update_project_spent()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE projects
  SET spent_lakhs = (
    SELECT COALESCE(SUM(amount_lakhs), 0)
    FROM expenses
    WHERE project_id = COALESCE(NEW.project_id, OLD.project_id)
      AND status IN ('approved','paid')
  )
  WHERE id = COALESCE(NEW.project_id, OLD.project_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER sync_project_spent
  AFTER INSERT OR UPDATE OR DELETE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_project_spent();
