import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../supabase';

// User colors palette for cursor colors
const userColors = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', 
  '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#d946ef', '#ec4899', '#f43f5e'
];

// Get a consistent color for a user based on their ID
const getUserColor = (userId) => {
  if (!userId) return userColors[0];
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return userColors[hash % userColors.length];
};

/**
 * Custom hook for Supabase Presence API
 * Tracks online users and their cursor positions in a board room
 */
export const usePresence = (boardId, user, getDisplayName, getAvatarUrl) => {
  const [onlineUsers, setOnlineUsers] = useState({});
  const [remoteCursors, setRemoteCursors] = useState({});
  const channelRef = useRef(null);
  const cursorThrottleRef = useRef(null);

  // Initialize presence channel
  useEffect(() => {
    if (!boardId || !user) return;

    const channelName = `board:${boardId}`;
    
    // Create a new channel for this board
    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    channelRef.current = channel;

    // Handle presence sync (initial state and updates)
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const users = {};
      
      Object.entries(state).forEach(([key, presences]) => {
        // Get the most recent presence for each user
        const presence = presences[0];
        if (presence && key !== user.id) {
          users[key] = {
            odId: key,
            userName: presence.user_name,
            avatarUrl: presence.avatar_url,
            userColor: presence.user_color,
            online_at: presence.online_at,
          };
        }
      });
      
      setOnlineUsers(users);
    });

    // Handle user joining
    channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      if (key === user.id) return; // Ignore self
      
      const presence = newPresences[0];
      if (presence) {
        console.log('User joined:', presence.user_name);
        setOnlineUsers(prev => ({
          ...prev,
          [key]: {
            odId: key,
            userName: presence.user_name,
            avatarUrl: presence.avatar_url,
            userColor: presence.user_color,
            online_at: presence.online_at,
          }
        }));
      }
    });

    // Handle user leaving
    channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      console.log('User left:', leftPresences[0]?.user_name);
      setOnlineUsers(prev => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });
      // Also remove their cursor
      setRemoteCursors(prev => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });
    });

    // Handle cursor broadcast messages
    channel.on('broadcast', { event: 'cursor' }, ({ payload }) => {
      if (payload.user_id === user.id) return; // Ignore self
      
      setRemoteCursors(prev => ({
        ...prev,
        [payload.user_id]: {
          x: payload.x,
          y: payload.y,
          userName: payload.user_name,
          userColor: payload.user_color,
          lastUpdate: Date.now(),
        }
      }));
    });

    // Subscribe to the channel and track presence
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        // Track this user's presence
        await channel.track({
          user_id: user.id,
          user_name: getDisplayName(),
          avatar_url: getAvatarUrl(),
          user_color: getUserColor(user.id),
          online_at: new Date().toISOString(),
        });
      }
    });

    // Cleanup on unmount
    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [boardId, user, getDisplayName, getAvatarUrl]);

  // Clean up stale cursors (haven't moved in 5 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setRemoteCursors(prev => {
        const updated = { ...prev };
        let changed = false;
        for (const [id, cursor] of Object.entries(updated)) {
          if (now - cursor.lastUpdate > 5000) {
            delete updated[id];
            changed = true;
          }
        }
        return changed ? updated : prev;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Broadcast cursor position (throttled)
  const updateCursor = useCallback((x, y) => {
    if (!channelRef.current || !user) return;

    // Throttle cursor updates to ~20fps
    if (cursorThrottleRef.current) return;
    
    cursorThrottleRef.current = setTimeout(() => {
      cursorThrottleRef.current = null;
    }, 50);

    channelRef.current.send({
      type: 'broadcast',
      event: 'cursor',
      payload: {
        user_id: user.id,
        user_name: getDisplayName(),
        user_color: getUserColor(user.id),
        x,
        y,
      },
    });
  }, [user, getDisplayName]);

  // Notify when cursor leaves the board
  const leaveCursor = useCallback(() => {
    if (!channelRef.current || !user) return;
    
    channelRef.current.send({
      type: 'broadcast',
      event: 'cursor',
      payload: {
        user_id: user.id,
        user_name: getDisplayName(),
        user_color: getUserColor(user.id),
        x: -1000, // Off-screen position to hide cursor
        y: -1000,
      },
    });
  }, [user, getDisplayName]);

  return {
    onlineUsers,
    remoteCursors,
    updateCursor,
    leaveCursor,
    userColor: user ? getUserColor(user.id) : userColors[0],
  };
};

export default usePresence;
