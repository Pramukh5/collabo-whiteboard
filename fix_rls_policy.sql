-- Fix RLS policy for accepting invites
-- Run this in your Supabase SQL Editor

-- First, drop the policy if it already exists (in case you ran the previous version)
DROP POLICY IF EXISTS "Users can add themselves as collaborators via invite" ON board_collaborators;
DROP POLICY IF EXISTS "Users can delete invites sent to their email" ON board_invites;
DROP FUNCTION IF EXISTS public.user_has_valid_invite(UUID, UUID);
DROP FUNCTION IF EXISTS public.invite_belongs_to_user(TEXT, UUID);
DROP FUNCTION IF EXISTS public.accept_board_invite(TEXT);

-- ============================================
-- SOLUTION: Use a SECURITY DEFINER function to handle the entire invite acceptance
-- This bypasses RLS entirely for this specific operation
-- ============================================

CREATE OR REPLACE FUNCTION public.accept_board_invite(invite_token TEXT)
RETURNS JSONB AS $$
DECLARE
  v_invite RECORD;
  v_user_email TEXT;
  v_user_id UUID;
  v_result JSONB;
BEGIN
  -- Get the current user's ID and email
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Get user email
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  
  -- Get the invite
  SELECT * INTO v_invite 
  FROM board_invites 
  WHERE token = invite_token 
  AND expires_at > NOW();
  
  IF v_invite IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invite not found or expired');
  END IF;
  
  -- Verify the invite is for this user's email
  IF LOWER(v_invite.email) != LOWER(v_user_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invite is for a different email address');
  END IF;
  
  -- Check if user is already a collaborator
  IF EXISTS (
    SELECT 1 FROM board_collaborators 
    WHERE board_id = v_invite.board_id 
    AND user_id = v_user_id
  ) THEN
    -- Already a collaborator, just delete the invite and return success
    DELETE FROM board_invites WHERE id = v_invite.id;
    RETURN jsonb_build_object(
      'success', true, 
      'board_id', v_invite.board_id,
      'message', 'Already a collaborator'
    );
  END IF;
  
  -- Add user as collaborator
  INSERT INTO board_collaborators (board_id, user_id, role, invited_by)
  VALUES (v_invite.board_id, v_user_id, v_invite.role, v_invite.invited_by);
  
  -- Update the board's collaborators array
  UPDATE boards 
  SET collaborators = array_append(COALESCE(collaborators, '{}'), v_user_id)
  WHERE id = v_invite.board_id
  AND NOT (v_user_id = ANY(COALESCE(collaborators, '{}')));
  
  -- Delete the invite
  DELETE FROM board_invites WHERE id = v_invite.id;
  
  -- Log the activity
  INSERT INTO activity_logs (board_id, user_id, action, details)
  VALUES (v_invite.board_id, v_user_id, 'joined', jsonb_build_object('method', 'invite', 'role', v_invite.role));
  
  RETURN jsonb_build_object(
    'success', true, 
    'board_id', v_invite.board_id,
    'role', v_invite.role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.accept_board_invite(TEXT) TO authenticated;

-- Also allow users to delete invites sent to their email (for declining)
CREATE OR REPLACE FUNCTION public.decline_board_invite(invite_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_email TEXT;
  v_invite_email TEXT;
BEGIN
  -- Get current user's email
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  
  -- Get invite email
  SELECT email INTO v_invite_email FROM board_invites WHERE id = invite_id;
  
  -- Check if invite belongs to this user
  IF LOWER(v_user_email) = LOWER(v_invite_email) THEN
    DELETE FROM board_invites WHERE id = invite_id;
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.decline_board_invite(UUID) TO authenticated;
