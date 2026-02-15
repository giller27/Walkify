-- =============================================
-- Fix: infinite recursion in conversation_participants RLS
-- Run this in Supabase SQL Editor
-- =============================================

-- Helper function: check if current user is in conversation (bypasses RLS)
CREATE OR REPLACE FUNCTION public.user_in_conversation(conv_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = conv_id AND user_id = auth.uid()
  );
$$;

-- Drop old policies that cause recursion
DROP POLICY IF EXISTS "Users can view conversation participants" ON conversation_participants;
DROP POLICY IF EXISTS "Users can add participants" ON conversation_participants;
DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can view messages in own conversations" ON messages;
DROP POLICY IF EXISTS "Users can send messages in own conversations" ON messages;

-- Recreate with function (no recursion)
CREATE POLICY "Users can view conversation participants"
  ON conversation_participants FOR SELECT
  USING (public.user_in_conversation(conversation_id));

CREATE POLICY "Users can add participants"
  ON conversation_participants FOR INSERT
  WITH CHECK (
    user_id = auth.uid() OR public.user_in_conversation(conversation_id)
  );

CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT
  USING (public.user_in_conversation(id));

CREATE POLICY "Users can view messages in own conversations"
  ON messages FOR SELECT
  USING (public.user_in_conversation(conversation_id));

CREATE POLICY "Users can send messages in own conversations"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND public.user_in_conversation(conversation_id)
  );

-- =============================================
-- Search users (bypasses RLS for search - profiles readable by all)
-- =============================================
CREATE OR REPLACE FUNCTION public.search_profiles(search_term TEXT)
RETURNS SETOF public.profiles
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT * FROM profiles
  WHERE full_name ILIKE '%' || search_term || '%'
     OR email ILIKE '%' || search_term || '%'
  LIMIT 10;
$$;
