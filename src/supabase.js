import { createClient } from '@supabase/supabase-js';

// Get these from your Supabase project settings -> API
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key exists:', !!supabaseAnonKey && supabaseAnonKey !== 'YOUR_SUPABASE_ANON_KEY');

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Auth helper functions
export const signUp = async (email, password, displayName) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
        avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}`,
      },
    },
  });
  return { data, error };
};

export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

export const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

export const getSession = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
};

// Database helper functions for boards
export const createBoard = async (title, userId) => {
  const { data, error } = await supabase
    .from('boards')
    .insert({
      title,
      owner_id: userId,
      scene_json: JSON.stringify({ objects: [], stickyNotes: [] }),
    })
    .select()
    .single();
  return { data, error };
};

export const getBoards = async (userId) => {
  try {
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const { data, error } = await supabase
      .from('boards')
      .select('*')
      .or(`owner_id.eq.${userId},collaborators.cs.{${userId}}`)
      .order('updated_at', { ascending: false })
      .abortSignal(controller.signal);
    
    clearTimeout(timeoutId);
    
    if (error) {
      console.error('getBoards error:', error);
    }
    return { data, error };
  } catch (err) {
    console.error('getBoards exception:', err);
    return { data: null, error: err };
  }
};

export const getBoard = async (boardId) => {
  const { data, error } = await supabase
    .from('boards')
    .select('*')
    .eq('id', boardId)
    .single();
  return { data, error };
};

export const updateBoard = async (boardId, updates) => {
  const { data, error } = await supabase
    .from('boards')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', boardId)
    .select()
    .single();
  return { data, error };
};

export const deleteBoard = async (boardId) => {
  const { error } = await supabase
    .from('boards')
    .delete()
    .eq('id', boardId);
  return { error };
};

export const saveBoardScene = async (boardId, sceneJson) => {
  const { data, error } = await supabase
    .from('boards')
    .update({
      scene_json: JSON.stringify(sceneJson),
      updated_at: new Date().toISOString(),
    })
    .eq('id', boardId)
    .select()
    .single();
  return { data, error };
};

// User profile functions
export const updateUserProfile = async (userId, updates) => {
  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  return { data, error };
};

export const getUserProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return { data, error };
};

// ============================================
// COLLABORATION FUNCTIONS
// ============================================

// Get all collaborators for a board
export const getBoardCollaborators = async (boardId) => {
  const { data, error } = await supabase
    .from('board_collaborators')
    .select(`
      *,
      user:profiles!board_collaborators_user_id_fkey(id, display_name, avatar_url),
      inviter:profiles!board_collaborators_invited_by_fkey(id, display_name)
    `)
    .eq('board_id', boardId);
  return { data, error };
};

// Add a collaborator directly (when accepting invite or adding existing user)
export const addCollaborator = async (boardId, userId, role = 'editor', invitedBy) => {
  // First add to board_collaborators table
  const { data, error } = await supabase
    .from('board_collaborators')
    .insert({
      board_id: boardId,
      user_id: userId,
      role,
      invited_by: invitedBy,
    })
    .select()
    .single();

  if (error) return { data: null, error };

  // Also update the collaborators array on the board
  const { data: board } = await getBoard(boardId);
  if (board) {
    const collaborators = board.collaborators || [];
    if (!collaborators.includes(userId)) {
      await updateBoard(boardId, {
        collaborators: [...collaborators, userId],
      });
    }
  }

  return { data, error: null };
};

// Remove a collaborator
export const removeCollaborator = async (boardId, userId) => {
  const { error } = await supabase
    .from('board_collaborators')
    .delete()
    .eq('board_id', boardId)
    .eq('user_id', userId);

  if (error) return { error };

  // Also update the collaborators array on the board
  const { data: board } = await getBoard(boardId);
  if (board) {
    const collaborators = (board.collaborators || []).filter(id => id !== userId);
    await updateBoard(boardId, { collaborators });
  }

  return { error: null };
};

// Update collaborator role
export const updateCollaboratorRole = async (boardId, userId, role) => {
  const { data, error } = await supabase
    .from('board_collaborators')
    .update({ role })
    .eq('board_id', boardId)
    .eq('user_id', userId)
    .select()
    .single();
  return { data, error };
};

// ============================================
// INVITE FUNCTIONS
// ============================================

// Create an invite for a board
export const createBoardInvite = async (boardId, email, role = 'editor', invitedBy) => {
  // Check if invite already exists
  const { data: existing } = await supabase
    .from('board_invites')
    .select('*')
    .eq('board_id', boardId)
    .eq('email', email.toLowerCase())
    .single();

  if (existing) {
    return { data: existing, error: null, isExisting: true };
  }

  const { data, error } = await supabase
    .from('board_invites')
    .insert({
      board_id: boardId,
      email: email.toLowerCase(),
      role,
      invited_by: invitedBy,
    })
    .select()
    .single();
  return { data, error, isExisting: false };
};

// Get invite by token
export const getInviteByToken = async (token) => {
  const { data, error } = await supabase
    .from('board_invites')
    .select(`
      *,
      board:boards(id, title, owner_id)
    `)
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .single();
  return { data, error };
};

// Get pending invites for a board
export const getBoardInvites = async (boardId) => {
  const { data, error } = await supabase
    .from('board_invites')
    .select('*')
    .eq('board_id', boardId)
    .gt('expires_at', new Date().toISOString());
  return { data, error };
};

// Accept an invite
export const acceptInvite = async (token, userId) => {
  console.log('acceptInvite called with token:', token, 'userId:', userId);
  
  // Use the security definer function to accept the invite
  // This bypasses RLS and handles everything in one atomic operation
  const { data, error } = await supabase
    .rpc('accept_board_invite', { invite_token: token });
  
  console.log('accept_board_invite result:', { data, error });
  
  if (error) {
    return { error };
  }
  
  if (!data.success) {
    return { error: { message: data.error } };
  }
  
  return { data: { board_id: data.board_id, role: data.role }, error: null };
};

// Delete/revoke an invite (for declining)
export const deleteInvite = async (inviteId) => {
  // Use the security definer function for users declining their own invites
  const { data, error } = await supabase
    .rpc('decline_board_invite', { invite_id: inviteId });
  
  // If the RPC fails (e.g., user is board owner deleting invite), try direct delete
  if (error) {
    const { error: deleteError } = await supabase
      .from('board_invites')
      .delete()
      .eq('id', inviteId);
    return { error: deleteError };
  }
  
  return { error: null };
};

// Get invites for current user's email
export const getMyPendingInvites = async (email) => {
  console.log('Fetching invites for email:', email);
  const { data, error } = await supabase
    .from('board_invites')
    .select(`
      *,
      board:boards(id, title)
    `)
    .eq('email', email.toLowerCase())
    .gt('expires_at', new Date().toISOString());
  
  console.log('Pending invites result:', { data, error });
  return { data, error };
};

// ============================================
// ACTIVITY LOG FUNCTIONS
// ============================================

// Log an activity
export const logActivity = async (boardId, userId, action, details = {}) => {
  const { data, error } = await supabase
    .from('activity_logs')
    .insert({
      board_id: boardId,
      user_id: userId,
      action,
      details,
    })
    .select()
    .single();
  return { data, error };
};

// Get activity logs for a board
export const getBoardActivity = async (boardId, limit = 50) => {
  const { data, error } = await supabase
    .from('activity_logs')
    .select(`
      *,
      user:profiles!activity_logs_user_id_fkey(id, display_name, avatar_url)
    `)
    .eq('board_id', boardId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return { data, error };
};

// Get recent activity across all user's boards
export const getRecentActivity = async (userId, limit = 20) => {
  const { data, error } = await supabase
    .from('activity_logs')
    .select(`
      *,
      board:boards!inner(id, title, owner_id, collaborators),
      user:profiles!activity_logs_user_id_fkey(id, display_name, avatar_url)
    `)
    .or(`board.owner_id.eq.${userId},board.collaborators.cs.{${userId}}`)
    .order('created_at', { ascending: false })
    .limit(limit);
  return { data, error };
};
