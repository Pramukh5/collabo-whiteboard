import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, getUserProfile, updateUserProfile } from '../supabase';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch user profile from profiles table
  const fetchProfile = async (userId) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    try {
      const { data, error } = await getUserProfile(userId);
      if (!error && data) {
        setProfile(data);
      } else {
        // Profile might not exist yet, that's okay
        console.log('Profile fetch:', error?.message || 'No profile found');
        setProfile(null);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setProfile(null);
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth event:', event);
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Update user profile
  const updateProfile = async (updates) => {
    if (!user) return { error: { message: 'Not authenticated' } };
    const { data, error } = await updateUserProfile(user.id, updates);
    if (!error && data) {
      setProfile(data);
    }
    return { data, error };
  };

  // Get user display name from profile or metadata
  const getDisplayName = () => {
    if (!user) return 'Guest';
    return (
      profile?.display_name ||
      user.user_metadata?.display_name ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] ||
      'User'
    );
  };

  // Get user avatar URL from profile or metadata
  const getAvatarUrl = () => {
    if (!user) return null;
    return (
      profile?.avatar_url ||
      user.user_metadata?.avatar_url ||
      user.user_metadata?.picture ||
      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(getDisplayName())}`
    );
  };

  const value = {
    user,
    profile,
    session,
    loading,
    isAuthenticated: !!user,
    getDisplayName,
    getAvatarUrl,
    updateProfile,
    refreshProfile: () => fetchProfile(user?.id),
    accessToken: session?.access_token,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
