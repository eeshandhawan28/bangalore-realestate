-- ============================================================
-- Migration 001: Organizations + Multi-tenancy Foundation
-- ============================================================

-- Organizations (tenants)
CREATE TABLE IF NOT EXISTS organizations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  tier          TEXT NOT NULL DEFAULT 'free'
                CHECK (tier IN ('free', 'pro', 'enterprise')),
  settings      JSONB DEFAULT '{}'::jsonb,
  schema_name   TEXT,
  locale        TEXT DEFAULT 'en',
  max_projects  INT DEFAULT 1,
  max_users     INT DEFAULT 1,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Org membership + roles
CREATE TABLE IF NOT EXISTS org_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'owner'
                  CHECK (role IN ('owner','manager','field_worker','contractor','investor')),
  permissions     JSONB DEFAULT '[]'::jsonb,
  invited_by      UUID REFERENCES auth.users(id),
  joined_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Per-user preferences
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  locale                TEXT DEFAULT 'en',
  voice_enabled         BOOLEAN DEFAULT false,
  timezone              TEXT DEFAULT 'Asia/Kolkata',
  notification_settings JSONB DEFAULT '{}'::jsonb,
  onboarding_completed  BOOLEAN DEFAULT false
);

-- Add organization_id to existing tables (nullable so existing rows aren't broken)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE listings   ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_org_members_user    ON org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org     ON org_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_properties_org      ON properties(organization_id);
CREATE INDEX IF NOT EXISTS idx_listings_org        ON listings(organization_id);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE organizations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Organizations: visible to members only
CREATE POLICY "org_members_can_view_org"
  ON organizations FOR SELECT
  USING (
    id IN (SELECT organization_id FROM org_members WHERE user_id = auth.uid())
  );

CREATE POLICY "org_owners_can_update_org"
  ON organizations FOR UPDATE
  USING (
    id IN (SELECT organization_id FROM org_members WHERE user_id = auth.uid() AND role = 'owner')
  );

-- Org members: members can see their org's member list
CREATE POLICY "org_members_can_view_members"
  ON org_members FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM org_members WHERE user_id = auth.uid())
  );

CREATE POLICY "org_owners_can_manage_members"
  ON org_members FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner','manager')
    )
  );

-- Allow users to insert themselves (for auto-org creation)
CREATE POLICY "users_can_join_orgs"
  ON org_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- User preferences: own row only
CREATE POLICY "users_can_view_own_preferences"
  ON user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_can_upsert_own_preferences"
  ON user_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Auto-create org for new users (via trigger) ───────────────
CREATE OR REPLACE FUNCTION create_org_for_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_org_id UUID;
  base_slug  TEXT;
  final_slug TEXT;
  counter    INT := 0;
BEGIN
  -- Generate slug from email prefix
  base_slug := regexp_replace(split_part(NEW.email, '@', 1), '[^a-z0-9]', '-', 'g');
  final_slug := base_slug;

  -- Ensure unique slug
  WHILE EXISTS (SELECT 1 FROM organizations WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  -- Create organization
  INSERT INTO organizations (name, slug, tier)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    final_slug,
    'free'
  )
  RETURNING id INTO new_org_id;

  -- Add user as owner
  INSERT INTO org_members (organization_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'owner');

  -- Create default preferences
  INSERT INTO user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_org_for_new_user();

-- ── Backfill: create orgs for existing users ─────────────────
DO $$
DECLARE
  u RECORD;
  new_org_id UUID;
  base_slug  TEXT;
  final_slug TEXT;
  counter    INT;
BEGIN
  FOR u IN
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    WHERE NOT EXISTS (
      SELECT 1 FROM org_members om WHERE om.user_id = au.id
    )
  LOOP
    counter := 0;
    base_slug := regexp_replace(split_part(u.email, '@', 1), '[^a-z0-9]', '-', 'g');
    final_slug := base_slug;

    WHILE EXISTS (SELECT 1 FROM organizations WHERE slug = final_slug) LOOP
      counter := counter + 1;
      final_slug := base_slug || '-' || counter;
    END LOOP;

    INSERT INTO organizations (name, slug, tier)
    VALUES (
      COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
      final_slug,
      'free'
    )
    RETURNING id INTO new_org_id;

    INSERT INTO org_members (organization_id, user_id, role)
    VALUES (new_org_id, u.id, 'owner');

    INSERT INTO user_preferences (user_id)
    VALUES (u.id)
    ON CONFLICT (user_id) DO NOTHING;

    -- Link existing properties to new org
    UPDATE properties SET organization_id = new_org_id WHERE user_id = u.id AND organization_id IS NULL;
    UPDATE listings   SET organization_id = new_org_id WHERE user_id = u.id AND organization_id IS NULL;
  END LOOP;
END;
$$;
