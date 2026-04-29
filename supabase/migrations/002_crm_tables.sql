-- ============================================================
-- Migration 002: CRM Tables (Contacts, Pipeline, Deals)
-- ============================================================

-- Contacts
CREATE TABLE IF NOT EXISTS contacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type            TEXT NOT NULL DEFAULT 'lead'
                  CHECK (type IN ('lead','client','contractor','vendor','investor','government')),
  first_name      TEXT NOT NULL,
  last_name       TEXT,
  company         TEXT,
  email           TEXT,
  phone           TEXT,
  whatsapp        TEXT,
  address         TEXT,
  city            TEXT,
  tags            TEXT[] DEFAULT '{}',
  custom_fields   JSONB DEFAULT '{}'::jsonb,
  source          TEXT,
  assigned_to     UUID REFERENCES auth.users(id),
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Deal Pipelines
CREATE TABLE IF NOT EXISTS pipelines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  is_default      BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Pipeline Stages
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id     UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  position        INT NOT NULL,
  color           TEXT DEFAULT '#6366f1',
  win_probability NUMERIC DEFAULT 0 CHECK (win_probability >= 0 AND win_probability <= 100),
  auto_actions    JSONB DEFAULT '[]'::jsonb
);

-- Deals
CREATE TABLE IF NOT EXISTS deals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  pipeline_id     UUID NOT NULL REFERENCES pipelines(id),
  stage_id        UUID NOT NULL REFERENCES pipeline_stages(id),
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  value_lakhs     NUMERIC,
  expected_close  DATE,
  probability     NUMERIC CHECK (probability >= 0 AND probability <= 100),
  assigned_to     UUID REFERENCES auth.users(id),
  tags            TEXT[] DEFAULT '{}',
  custom_fields   JSONB DEFAULT '{}'::jsonb,
  notes           TEXT,
  lost_reason     TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Deal Activity Log
CREATE TABLE IF NOT EXISTS deal_activities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id     UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'note'
              CHECK (type IN ('note','call','email','meeting','stage_change','value_change')),
  content     TEXT NOT NULL,
  metadata    JSONB DEFAULT '{}'::jsonb,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_contacts_org       ON contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_contacts_type      ON contacts(organization_id, type);
CREATE INDEX IF NOT EXISTS idx_contacts_assigned  ON contacts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_deals_org          ON deals(organization_id);
CREATE INDEX IF NOT EXISTS idx_deals_pipeline     ON deals(pipeline_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_deals_assigned     ON deals(assigned_to);
CREATE INDEX IF NOT EXISTS idx_deal_activities    ON deal_activities(deal_id, created_at DESC);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE contacts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipelines        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals            ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_activities  ENABLE ROW LEVEL SECURITY;

-- Helper: check org membership
CREATE OR REPLACE FUNCTION is_org_member(org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members
    WHERE organization_id = org_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Contacts: all org members can view; managers+ can insert/update/delete
CREATE POLICY "org_members_view_contacts"
  ON contacts FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "org_members_create_contacts"
  ON contacts FOR INSERT
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "org_members_update_contacts"
  ON contacts FOR UPDATE
  USING (is_org_member(organization_id));

CREATE POLICY "org_members_delete_contacts"
  ON contacts FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM org_members
      WHERE user_id = auth.uid() AND role IN ('owner','manager')
    )
  );

-- Pipelines
CREATE POLICY "org_members_view_pipelines"
  ON pipelines FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "org_owners_manage_pipelines"
  ON pipelines FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM org_members
      WHERE user_id = auth.uid() AND role IN ('owner','manager')
    )
  );

-- Pipeline stages (accessible if org member)
CREATE POLICY "org_members_view_stages"
  ON pipeline_stages FOR SELECT
  USING (
    pipeline_id IN (
      SELECT id FROM pipelines WHERE is_org_member(organization_id)
    )
  );

CREATE POLICY "org_owners_manage_stages"
  ON pipeline_stages FOR ALL
  USING (
    pipeline_id IN (
      SELECT p.id FROM pipelines p
      JOIN org_members om ON om.organization_id = p.organization_id
      WHERE om.user_id = auth.uid() AND om.role IN ('owner','manager')
    )
  );

-- Deals
CREATE POLICY "org_members_view_deals"
  ON deals FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "org_members_create_deals"
  ON deals FOR INSERT WITH CHECK (is_org_member(organization_id));

CREATE POLICY "org_members_update_deals"
  ON deals FOR UPDATE USING (is_org_member(organization_id));

CREATE POLICY "org_managers_delete_deals"
  ON deals FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM org_members
      WHERE user_id = auth.uid() AND role IN ('owner','manager')
    )
  );

-- Deal activities
CREATE POLICY "org_members_view_activities"
  ON deal_activities FOR SELECT
  USING (
    deal_id IN (SELECT id FROM deals WHERE is_org_member(organization_id))
  );

CREATE POLICY "org_members_create_activities"
  ON deal_activities FOR INSERT
  WITH CHECK (
    deal_id IN (SELECT id FROM deals WHERE is_org_member(organization_id))
  );

-- ── Seed default pipeline for new orgs ───────────────────────
CREATE OR REPLACE FUNCTION seed_default_pipeline(p_org_id UUID)
RETURNS VOID AS $$
DECLARE
  new_pipeline_id UUID;
BEGIN
  INSERT INTO pipelines (organization_id, name, description, is_default)
  VALUES (p_org_id, 'Sales Pipeline', 'Default sales pipeline', true)
  RETURNING id INTO new_pipeline_id;

  INSERT INTO pipeline_stages (pipeline_id, name, position, color, win_probability) VALUES
    (new_pipeline_id, 'Prospecting',   1, '#94a3b8', 10),
    (new_pipeline_id, 'Qualification', 2, '#6366f1', 25),
    (new_pipeline_id, 'Proposal',      3, '#f59e0b', 50),
    (new_pipeline_id, 'Negotiation',   4, '#f97316', 75),
    (new_pipeline_id, 'Closed Won',    5, '#10b981', 100),
    (new_pipeline_id, 'Closed Lost',   6, '#ef4444', 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Extend the user creation trigger to also seed default pipeline
CREATE OR REPLACE FUNCTION create_org_for_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_org_id UUID;
  base_slug  TEXT;
  final_slug TEXT;
  counter    INT := 0;
BEGIN
  base_slug := regexp_replace(split_part(NEW.email, '@', 1), '[^a-z0-9]', '-', 'g');
  final_slug := base_slug;

  WHILE EXISTS (SELECT 1 FROM organizations WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  INSERT INTO organizations (name, slug, tier)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    final_slug,
    'free'
  )
  RETURNING id INTO new_org_id;

  INSERT INTO org_members (organization_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'owner');

  INSERT INTO user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Seed default pipeline
  PERFORM seed_default_pipeline(new_org_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill default pipelines for existing orgs that don't have one
DO $$
DECLARE
  org RECORD;
BEGIN
  FOR org IN
    SELECT id FROM organizations
    WHERE NOT EXISTS (SELECT 1 FROM pipelines WHERE organization_id = organizations.id AND is_default = true)
  LOOP
    PERFORM seed_default_pipeline(org.id);
  END LOOP;
END;
$$;
