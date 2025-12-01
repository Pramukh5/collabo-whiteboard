-- Collabo Whiteboard - Supabase Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES TABLE
-- Stores additional user profile information
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', 'https://api.dicebear.com/7.x/initials/svg?seed=' || encode(NEW.id::text::bytea, 'base64'))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- BOARDS TABLE
-- Stores whiteboard data
-- ============================================
CREATE TABLE IF NOT EXISTS boards (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Untitled Board',
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  scene_json JSONB DEFAULT '{"objects": [], "stickyNotes": []}'::jsonb,
  thumbnail_url TEXT,
  is_public BOOLEAN DEFAULT false,
  collaborators UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;

-- Boards policies
CREATE POLICY "Users can view their own boards"
  ON boards FOR SELECT
  USING (
    auth.uid() = owner_id 
    OR auth.uid() = ANY(collaborators)
    OR is_public = true
  );

CREATE POLICY "Users can create boards"
  ON boards FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their boards"
  ON boards FOR UPDATE
  USING (auth.uid() = owner_id OR auth.uid() = ANY(collaborators));

CREATE POLICY "Owners can delete their boards"
  ON boards FOR DELETE
  USING (auth.uid() = owner_id);

-- ============================================
-- BOARD COLLABORATORS TABLE
-- Manages board access permissions
-- ============================================
CREATE TABLE IF NOT EXISTS board_collaborators (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  board_id UUID REFERENCES boards(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'editor' CHECK (role IN ('viewer', 'editor', 'admin')),
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(board_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE board_collaborators ENABLE ROW LEVEL SECURITY;

-- Collaborators policies
CREATE POLICY "Users can view collaborators of their boards"
  ON board_collaborators FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM boards 
      WHERE boards.id = board_collaborators.board_id 
      AND (boards.owner_id = auth.uid() OR auth.uid() = ANY(boards.collaborators))
    )
  );

CREATE POLICY "Board owners can add collaborators"
  ON board_collaborators FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM boards 
      WHERE boards.id = board_collaborators.board_id 
      AND boards.owner_id = auth.uid()
    )
  );

CREATE POLICY "Board owners can remove collaborators"
  ON board_collaborators FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM boards 
      WHERE boards.id = board_collaborators.board_id 
      AND boards.owner_id = auth.uid()
    )
  );

-- ============================================
-- ACTIVITY LOGS TABLE
-- Tracks user activity on boards
-- ============================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  board_id UUID REFERENCES boards(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'joined', 'left', 'shared')),
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Activity logs policies
CREATE POLICY "Users can view activity for their boards"
  ON activity_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM boards 
      WHERE boards.id = activity_logs.board_id 
      AND (boards.owner_id = auth.uid() OR auth.uid() = ANY(boards.collaborators))
    )
  );

CREATE POLICY "Users can insert activity logs"
  ON activity_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- BOARD INVITES TABLE
-- Manages pending invitations
-- ============================================
CREATE TABLE IF NOT EXISTS board_invites (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  board_id UUID REFERENCES boards(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'editor' CHECK (role IN ('viewer', 'editor')),
  invited_by UUID REFERENCES auth.users(id) NOT NULL,
  token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE board_invites ENABLE ROW LEVEL SECURITY;

-- Invites policies
CREATE POLICY "Board owners can create invites"
  ON board_invites FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM boards 
      WHERE boards.id = board_invites.board_id 
      AND boards.owner_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view invite by token"
  ON board_invites FOR SELECT
  USING (true);

CREATE POLICY "Board owners can delete invites"
  ON board_invites FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM boards 
      WHERE boards.id = board_invites.board_id 
      AND boards.owner_id = auth.uid()
    )
  );

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_boards_owner ON boards(owner_id);
CREATE INDEX IF NOT EXISTS idx_boards_updated ON boards(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_boards_collaborators ON boards USING GIN(collaborators);
CREATE INDEX IF NOT EXISTS idx_board_collaborators_board ON board_collaborators(board_id);
CREATE INDEX IF NOT EXISTS idx_board_collaborators_user ON board_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_board ON activity_logs(board_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_board_invites_token ON board_invites(token);
CREATE INDEX IF NOT EXISTS idx_board_invites_email ON board_invites(email);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for boards updated_at
DROP TRIGGER IF EXISTS update_boards_updated_at ON boards;
CREATE TRIGGER update_boards_updated_at
  BEFORE UPDATE ON boards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for profiles updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
