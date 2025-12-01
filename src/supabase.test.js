/**
 * Supabase Integration Tests
 * 
 * Note: These tests verify the API structure of supabase functions.
 * For full integration testing, use a test database or mock at a higher level.
 */

// Import the actual functions to test their existence and types
import * as supabaseModule from './supabase';

describe('Supabase Module Exports', () => {
  describe('Auth Functions', () => {
    test('exports signUp function', () => {
      expect(typeof supabaseModule.signUp).toBe('function');
    });

    test('exports signIn function', () => {
      expect(typeof supabaseModule.signIn).toBe('function');
    });

    test('exports signInWithGoogle function', () => {
      expect(typeof supabaseModule.signInWithGoogle).toBe('function');
    });

    test('exports signOut function', () => {
      expect(typeof supabaseModule.signOut).toBe('function');
    });

    test('exports getCurrentUser function', () => {
      expect(typeof supabaseModule.getCurrentUser).toBe('function');
    });

    test('exports getSession function', () => {
      expect(typeof supabaseModule.getSession).toBe('function');
    });
  });

  describe('Board Functions', () => {
    test('exports createBoard function', () => {
      expect(typeof supabaseModule.createBoard).toBe('function');
    });

    test('exports getBoards function', () => {
      expect(typeof supabaseModule.getBoards).toBe('function');
    });

    test('exports getBoard function', () => {
      expect(typeof supabaseModule.getBoard).toBe('function');
    });

    test('exports saveBoardScene function', () => {
      expect(typeof supabaseModule.saveBoardScene).toBe('function');
    });

    test('exports deleteBoard function', () => {
      expect(typeof supabaseModule.deleteBoard).toBe('function');
    });
  });

  describe('Profile Functions', () => {
    test('exports getUserProfile function', () => {
      expect(typeof supabaseModule.getUserProfile).toBe('function');
    });

    test('exports updateUserProfile function', () => {
      expect(typeof supabaseModule.updateUserProfile).toBe('function');
    });
  });

  describe('Supabase Client', () => {
    test('exports supabase client', () => {
      expect(supabaseModule.supabase).toBeDefined();
    });

    test('supabase client has auth property', () => {
      expect(supabaseModule.supabase.auth).toBeDefined();
    });

    test('supabase client has from method', () => {
      expect(typeof supabaseModule.supabase.from).toBe('function');
    });
  });
});

describe('Function Signatures', () => {
  test('signUp accepts email, password, and displayName', async () => {
    // Just verify function accepts parameters without throwing synchronously
    expect(() => {
      // Don't await - just test signature
      supabaseModule.signUp('test@test.com', 'password', 'Name');
    }).not.toThrow();
  });

  test('signIn accepts email and password', async () => {
    expect(() => {
      supabaseModule.signIn('test@test.com', 'password');
    }).not.toThrow();
  });

  test('createBoard accepts title and userId', async () => {
    expect(() => {
      supabaseModule.createBoard('Test Board', 'user-123');
    }).not.toThrow();
  });

  test('getBoards accepts userId', async () => {
    expect(() => {
      supabaseModule.getBoards('user-123');
    }).not.toThrow();
  });

  test('getBoard accepts boardId', async () => {
    expect(() => {
      supabaseModule.getBoard('board-123');
    }).not.toThrow();
  });

  test('saveBoardScene accepts boardId and sceneData', async () => {
    expect(() => {
      supabaseModule.saveBoardScene('board-123', { objects: [], stickyNotes: [] });
    }).not.toThrow();
  });

  test('deleteBoard accepts boardId', async () => {
    expect(() => {
      supabaseModule.deleteBoard('board-123');
    }).not.toThrow();
  });

  test('getUserProfile accepts userId', async () => {
    expect(() => {
      supabaseModule.getUserProfile('user-123');
    }).not.toThrow();
  });

  test('updateUserProfile accepts userId and updates', async () => {
    expect(() => {
      supabaseModule.updateUserProfile('user-123', { display_name: 'New Name' });
    }).not.toThrow();
  });
});
