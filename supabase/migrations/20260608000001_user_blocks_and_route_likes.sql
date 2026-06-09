-- User blocks (chat) and route likes (public routes)

-- ============ USER BLOCKS ============
CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_id);

ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own blocks"
  ON user_blocks FOR SELECT
  USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);

CREATE POLICY "Users can block others"
  ON user_blocks FOR INSERT
  WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can unblock others"
  ON user_blocks FOR DELETE
  USING (auth.uid() = blocker_id);

-- ============ ROUTE LIKES ============
ALTER TABLE routes ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS route_likes (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, route_id)
);

CREATE INDEX IF NOT EXISTS idx_route_likes_route ON route_likes(route_id);
CREATE INDEX IF NOT EXISTS idx_route_likes_user ON route_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_routes_likes_count ON routes(likes_count DESC) WHERE is_public = true;

ALTER TABLE route_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read route likes"
  ON route_likes FOR SELECT
  USING (true);

CREATE POLICY "Users can like routes"
  ON route_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike routes"
  ON route_likes FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_route_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.routes
    SET likes_count = likes_count + 1
    WHERE id = NEW.route_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.routes
    SET likes_count = GREATEST(0, likes_count - 1)
    WHERE id = OLD.route_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_route_likes_count ON route_likes;
CREATE TRIGGER trigger_route_likes_count
  AFTER INSERT OR DELETE ON route_likes
  FOR EACH ROW EXECUTE PROCEDURE public.update_route_likes_count();
