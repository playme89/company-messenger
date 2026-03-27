-- ============================================================
-- Company Messenger - Complete Supabase Schema
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES TABLE (extends auth.users)
-- ============================================================
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  is_online BOOLEAN DEFAULT FALSE,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  role TEXT DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROOMS TABLE
-- ============================================================
CREATE TABLE public.rooms (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('direct', 'group')),
  name TEXT,
  description TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROOM MEMBERS TABLE
-- ============================================================
CREATE TABLE public.room_members (
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

-- ============================================================
-- MESSAGES TABLE
-- ============================================================
CREATE TABLE public.messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  content TEXT,
  file_url TEXT,
  file_name TEXT,
  file_type TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MESSAGE READS TABLE
-- ============================================================
CREATE TABLE public.message_reads (
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id)
);

-- ============================================================
-- NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE public.notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  from_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('message', 'mention', 'room_invite')),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_messages_room_id ON public.messages(room_id);
CREATE INDEX idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX idx_room_members_user_id ON public.room_members(user_id);
CREATE INDEX idx_room_members_room_id ON public.room_members(room_id);
CREATE INDEX idx_message_reads_message_id ON public.message_reads(message_id);
CREATE INDEX idx_message_reads_user_id ON public.message_reads(user_id);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(user_id, is_read);
CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_profiles_is_online ON public.profiles(is_online);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Check if current user is member of a room
CREATE OR REPLACE FUNCTION public.is_room_member(p_room_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_members
    WHERE room_id = p_room_id AND user_id = auth.uid()
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Get or create direct message room between two users
CREATE OR REPLACE FUNCTION public.get_or_create_dm(other_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_room_id UUID;
  v_current_user UUID := auth.uid();
BEGIN
  -- Check if DM room already exists
  SELECT rm1.room_id INTO v_room_id
  FROM public.room_members rm1
  JOIN public.room_members rm2 ON rm1.room_id = rm2.room_id
  JOIN public.rooms r ON r.id = rm1.room_id
  WHERE rm1.user_id = v_current_user
    AND rm2.user_id = other_user_id
    AND r.type = 'direct'
  LIMIT 1;

  IF v_room_id IS NULL THEN
    -- Create new DM room
    INSERT INTO public.rooms (type, created_by)
    VALUES ('direct', v_current_user)
    RETURNING id INTO v_room_id;

    -- Add both users
    INSERT INTO public.room_members (room_id, user_id)
    VALUES (v_room_id, v_current_user), (v_room_id, other_user_id);
  END IF;

  RETURN v_room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_username TEXT;
  v_full_name TEXT;
BEGIN
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );
  v_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1)
  );

  -- Ensure username is unique by appending number if needed
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = v_username) LOOP
    v_username := v_username || floor(random() * 1000)::TEXT;
  END LOOP;

  INSERT INTO public.profiles (id, username, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    v_username,
    v_full_name,
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_user_meta_data->>'role', 'member')
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create notification on new message
CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS TRIGGER AS $$
DECLARE
  v_member RECORD;
BEGIN
  -- Create notifications for all room members except sender
  FOR v_member IN
    SELECT user_id FROM public.room_members
    WHERE room_id = NEW.room_id AND user_id != NEW.sender_id
  LOOP
    INSERT INTO public.notifications (user_id, from_user_id, room_id, message_id, type)
    VALUES (v_member.user_id, NEW.sender_id, NEW.room_id, NEW.id, 'message');
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-create notifications on new message
CREATE TRIGGER on_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_message();

-- Update timestamps
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_rooms_updated_at
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROFILES POLICIES
-- ============================================================
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR is_admin())
  WITH CHECK (id = auth.uid() OR is_admin());

CREATE POLICY "profiles_delete_admin"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (is_admin());

-- ============================================================
-- ROOMS POLICIES
-- ============================================================
CREATE POLICY "rooms_select_member"
  ON public.rooms FOR SELECT
  TO authenticated
  USING (
    is_room_member(id) OR is_admin()
  );

CREATE POLICY "rooms_insert_authenticated"
  ON public.rooms FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid() OR is_admin());

CREATE POLICY "rooms_update_admin"
  ON public.rooms FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() OR is_admin());

CREATE POLICY "rooms_delete_admin"
  ON public.rooms FOR DELETE
  TO authenticated
  USING (is_admin());

-- ============================================================
-- ROOM_MEMBERS POLICIES
-- ============================================================
CREATE POLICY "room_members_select_member"
  ON public.room_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR is_room_member(room_id)
    OR is_admin()
  );

CREATE POLICY "room_members_insert_authenticated"
  ON public.room_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR is_admin()
    OR EXISTS (
      SELECT 1 FROM public.rooms
      WHERE id = room_id AND created_by = auth.uid()
    )
  );

CREATE POLICY "room_members_delete_self_or_admin"
  ON public.room_members FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR is_admin());

-- ============================================================
-- MESSAGES POLICIES
-- ============================================================
CREATE POLICY "messages_select_room_member"
  ON public.messages FOR SELECT
  TO authenticated
  USING (is_room_member(room_id) OR is_admin());

CREATE POLICY "messages_insert_room_member"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = auth.uid() AND is_room_member(room_id));

CREATE POLICY "messages_update_own_or_admin"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid() OR is_admin());

CREATE POLICY "messages_delete_admin"
  ON public.messages FOR DELETE
  TO authenticated
  USING (is_admin());

-- ============================================================
-- MESSAGE_READS POLICIES
-- ============================================================
CREATE POLICY "message_reads_select_own"
  ON public.message_reads FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR is_admin()
    OR EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.room_members rm ON rm.room_id = m.room_id
      WHERE m.id = message_id AND rm.user_id = auth.uid()
    )
  );

CREATE POLICY "message_reads_insert_own"
  ON public.message_reads FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "message_reads_update_own"
  ON public.message_reads FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- NOTIFICATIONS POLICIES
-- ============================================================
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifications_delete_own"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- ENABLE REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reads;

-- ============================================================
-- STORAGE
-- ============================================================
-- Run this after creating the 'chat-files' bucket in Supabase Dashboard
-- Or uncomment if using Supabase CLI:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('chat-files', 'chat-files', true);

CREATE POLICY "chat_files_select_authenticated"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'chat-files');

CREATE POLICY "chat_files_insert_authenticated"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'chat-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "chat_files_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'chat-files' AND auth.uid()::TEXT = (storage.foldername(name))[1]);
