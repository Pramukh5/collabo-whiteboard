import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { supabase } from '../supabase';

// Mock supabase
jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
    },
  },
  getUserProfile: jest.fn(),
  updateUserProfile: jest.fn(),
}));

describe('AuthContext', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    user_metadata: {
      display_name: 'Test User',
      avatar_url: 'https://example.com/avatar.png',
    },
  };

  const mockSession = {
    user: mockUser,
    access_token: 'mock-access-token',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
    supabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    });
  });

  describe('Initial State', () => {
    test('starts with loading state', async () => {
      supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
      
      const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      // Initially loading
      expect(result.current.loading).toBe(true);
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    test('user is null when not authenticated', async () => {
      supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
      
      const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    test('user is set when authenticated', async () => {
      supabase.auth.getSession.mockResolvedValue({ data: { session: mockSession } });
      
      const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  describe('Auth State Changes', () => {
    test('updates user on SIGNED_IN event', async () => {
      let authCallback;
      
      supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
      supabase.auth.onAuthStateChange.mockImplementation((callback) => {
        authCallback = callback;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      });
      
      const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      expect(result.current.user).toBeNull();
      
      // Simulate sign in
      act(() => {
        authCallback('SIGNED_IN', mockSession);
      });
      
      expect(result.current.user).toEqual(mockUser);
    });

    test('clears user on SIGNED_OUT event', async () => {
      let authCallback;
      
      supabase.auth.getSession.mockResolvedValue({ data: { session: mockSession } });
      supabase.auth.onAuthStateChange.mockImplementation((callback) => {
        authCallback = callback;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      });
      
      const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });
      
      // Simulate sign out
      act(() => {
        authCallback('SIGNED_OUT', null);
      });
      
      expect(result.current.user).toBeNull();
    });
  });

  describe('Access Token', () => {
    test('provides access token when authenticated', async () => {
      supabase.auth.getSession.mockResolvedValue({ data: { session: mockSession } });
      
      const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.accessToken).toBe('mock-access-token');
      });
    });

    test('access token is undefined when not authenticated', async () => {
      supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
      
      const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      expect(result.current.accessToken).toBeUndefined();
    });
  });

  describe('Helper Functions', () => {
    test('getDisplayName returns display name from metadata', async () => {
      supabase.auth.getSession.mockResolvedValue({ data: { session: mockSession } });
      
      const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      expect(result.current.getDisplayName()).toBe('Test User');
    });

    test('getDisplayName falls back to email if no display name', async () => {
      const userWithoutDisplayName = {
        ...mockUser,
        user_metadata: {},
      };
      
      supabase.auth.getSession.mockResolvedValue({ 
        data: { session: { ...mockSession, user: userWithoutDisplayName } } 
      });
      
      const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      // Should return email username part or full email
      expect(result.current.getDisplayName()).toContain('test');
    });

    test('getAvatarUrl returns avatar from metadata', async () => {
      supabase.auth.getSession.mockResolvedValue({ data: { session: mockSession } });
      
      const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      expect(result.current.getAvatarUrl()).toBe('https://example.com/avatar.png');
    });
  });

  describe('Error Handling', () => {
    test('useAuth returns empty context outside AuthProvider', () => {
      // When used outside provider, useContext returns the default value (empty object)
      // This test documents the current behavior
      const { result } = renderHook(() => useAuth());
      
      // The context returns an empty object since no provider exists
      // and default value is an empty object
      expect(result.current).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    test('unsubscribes from auth changes on unmount', async () => {
      const unsubscribeMock = jest.fn();
      
      supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
      supabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: unsubscribeMock } },
      });
      
      const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
      const { unmount } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => {
        // Wait for initial load
      });
      
      unmount();
      
      expect(unsubscribeMock).toHaveBeenCalled();
    });
  });
});
