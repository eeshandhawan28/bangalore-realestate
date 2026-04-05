-- Properties (portfolio)
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  area_type TEXT NOT NULL,
  total_sqft NUMERIC NOT NULL,
  bhk INTEGER NOT NULL,
  bathrooms INTEGER NOT NULL,
  balconies INTEGER DEFAULT 0,
  purchase_price_lakhs NUMERIC NOT NULL,
  purchase_date DATE NOT NULL,
  ownership_type TEXT DEFAULT 'self-occupied',
  notes TEXT,
  ai_estimated_value_lakhs NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own properties"
  ON properties FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own properties"
  ON properties FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own properties"
  ON properties FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own properties"
  ON properties FOR DELETE
  USING (auth.uid() = user_id);


-- Marketplace Listings
CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id),
  listing_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT NOT NULL,
  area_type TEXT NOT NULL,
  total_sqft NUMERIC NOT NULL,
  bhk INTEGER NOT NULL,
  bathrooms INTEGER NOT NULL,
  balconies INTEGER DEFAULT 0,
  asking_price_lakhs NUMERIC,
  monthly_rent INTEGER,
  ai_estimated_price_lakhs NUMERIC,
  contact_email TEXT,
  contact_phone TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active listings"
  ON listings FOR SELECT
  USING (is_active = true);

CREATE POLICY "Users can insert own listings"
  ON listings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own listings"
  ON listings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own listings"
  ON listings FOR DELETE
  USING (auth.uid() = user_id);


-- Valuation History
CREATE TABLE IF NOT EXISTS valuations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  location TEXT NOT NULL,
  area_type TEXT NOT NULL,
  total_sqft NUMERIC NOT NULL,
  bhk INTEGER NOT NULL,
  bathrooms INTEGER NOT NULL,
  balconies INTEGER DEFAULT 0,
  predicted_price_lakhs NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE valuations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own valuations"
  ON valuations FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Anyone can insert valuations"
  ON valuations FOR INSERT
  WITH CHECK (true);
