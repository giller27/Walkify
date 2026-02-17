-- =============================================
-- Walkify - Users (Profiles) & Routes Database
-- Run this in Supabase SQL Editor
-- =============================================

-- ============ PROFILES (User extensions) ============
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  total_walks INTEGER DEFAULT 0,
  total_distance NUMERIC DEFAULT 0,
  total_time NUMERIC DEFAULT 0,
  average_pace NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for search
CREATE INDEX IF NOT EXISTS idx_profiles_full_name ON profiles(full_name);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============ ROUTES ============
CREATE TABLE IF NOT EXISTS routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  points JSONB NOT NULL DEFAULT '[]',
  waypoints JSONB,
  statistics JSONB NOT NULL,
  preferences JSONB,
  geo_json JSONB,
  tags TEXT[] DEFAULT '{}',
  difficulty TEXT DEFAULT 'moderate' CHECK (difficulty IN ('easy', 'moderate', 'hard')),
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_routes_user_id ON routes(user_id);
CREATE INDEX IF NOT EXISTS idx_routes_is_public ON routes(is_public);
CREATE INDEX IF NOT EXISTS idx_routes_created_at ON routes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_routes_tags ON routes USING GIN(tags);

-- ============ SAVED FAVORITES (user favorite routes) ============
CREATE TABLE IF NOT EXISTS saved_favorites (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, route_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_favorites_user ON saved_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_favorites_route ON saved_favorites(route_id);

-- ============ WALK STATISTICS ============
CREATE TABLE IF NOT EXISTS walk_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  route_id UUID REFERENCES routes(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  distance_km NUMERIC NOT NULL,
  duration_minutes NUMERIC NOT NULL,
  pace NUMERIC NOT NULL,
  calories NUMERIC,
  steps INTEGER,
  elevation_gain NUMERIC,
  weather TEXT,
  mood TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_walk_statistics_user ON walk_statistics(user_id);
CREATE INDEX IF NOT EXISTS idx_walk_statistics_date ON walk_statistics(user_id, date DESC);

-- ============ ROW LEVEL SECURITY (RLS) ============
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE walk_statistics ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all (for search, profiles), update own
CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Routes: users manage own, everyone can read public
CREATE POLICY "Users can view own routes"
  ON routes FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view public routes"
  ON routes FOR SELECT USING (is_public = true);

CREATE POLICY "Users can insert own routes"
  ON routes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own routes"
  ON routes FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own routes"
  ON routes FOR DELETE USING (auth.uid() = user_id);

-- Routes: allow reading for favorites join (public routes)
-- The above policies cover: own routes + public routes

-- Saved favorites: users manage own
CREATE POLICY "Users can view own favorites"
  ON saved_favorites FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can add own favorites"
  ON saved_favorites FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites"
  ON saved_favorites FOR DELETE USING (auth.uid() = user_id);

-- Walk statistics: users manage own
CREATE POLICY "Users can view own statistics"
  ON walk_statistics FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own statistics"
  ON walk_statistics FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own statistics"
  ON walk_statistics FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own statistics"
  ON walk_statistics FOR DELETE USING (auth.uid() = user_id);

-- ============ STORAGE: Avatars bucket ============
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their folder
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' AND
    auth.role() = 'authenticated' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
