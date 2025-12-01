import { renderHook, act, waitFor } from '@testing-library/react';
import { usePresence } from './usePresence';

// Mock supabase
jest.mock('../supabase', () => ({
  supabase: {
    channel: jest.fn(),
  },
}));

import { supabase } from '../supabase';

describe('usePresence Hook', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockChannel = {
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnThis(),
    track: jest.fn().mockResolvedValue('ok'),
    untrack: jest.fn().mockResolvedValue('ok'),
    unsubscribe: jest.fn(),
    presenceState: jest.fn().mockReturnValue({}),
    send: jest.fn().mockResolvedValue('ok'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    supabase.channel.mockReturnValue(mockChannel);
  });

  describe('Initialization', () => {
    test('creates presence channel with board ID', () => {
      const boardId = 'board-123';
      
      renderHook(() => usePresence(
        boardId,
        mockUser,
        () => 'Test User',
        () => 'https://example.com/avatar.png'
      ));
      
      expect(supabase.channel).toHaveBeenCalled();
      // Verify the channel name contains the board ID
      const channelCall = supabase.channel.mock.calls[0][0];
      expect(channelCall).toContain(boardId);
    });

    test('returns object with expected properties', () => {
      const { result } = renderHook(() => usePresence(
        'board-123',
        mockUser,
        () => 'Test User',
        () => 'https://example.com/avatar.png'
      ));
      
      expect(result.current).toHaveProperty('onlineUsers');
      expect(result.current).toHaveProperty('remoteCursors');
      expect(result.current).toHaveProperty('updateCursor');
      expect(result.current).toHaveProperty('leaveCursor');
    });

    test('does not create channel without user', () => {
      renderHook(() => usePresence(
        'board-123',
        null,
        () => 'Test User',
        () => 'https://example.com/avatar.png'
      ));
      
      expect(supabase.channel).not.toHaveBeenCalled();
    });

    test('does not create channel without board ID', () => {
      renderHook(() => usePresence(
        null,
        mockUser,
        () => 'Test User',
        () => 'https://example.com/avatar.png'
      ));
      
      expect(supabase.channel).not.toHaveBeenCalled();
    });
  });

  describe('Presence Subscription', () => {
    test('subscribes to presence events', () => {
      renderHook(() => usePresence(
        'board-123',
        mockUser,
        () => 'Test User',
        () => 'https://example.com/avatar.png'
      ));
      
      expect(mockChannel.on).toHaveBeenCalled();
      expect(mockChannel.subscribe).toHaveBeenCalled();
    });
  });

  describe('Cursor Functions', () => {
    test('provides updateCursor function', () => {
      const { result } = renderHook(() => usePresence(
        'board-123',
        mockUser,
        () => 'Test User',
        () => 'https://example.com/avatar.png'
      ));
      
      expect(typeof result.current.updateCursor).toBe('function');
    });

    test('provides leaveCursor function', () => {
      const { result } = renderHook(() => usePresence(
        'board-123',
        mockUser,
        () => 'Test User',
        () => 'https://example.com/avatar.png'
      ));
      
      expect(typeof result.current.leaveCursor).toBe('function');
    });

    test('updateCursor can be called without throwing', () => {
      const { result } = renderHook(() => usePresence(
        'board-123',
        mockUser,
        () => 'Test User',
        () => 'https://example.com/avatar.png'
      ));
      
      expect(() => result.current.updateCursor(100, 200)).not.toThrow();
    });

    test('leaveCursor can be called without throwing', () => {
      const { result } = renderHook(() => usePresence(
        'board-123',
        mockUser,
        () => 'Test User',
        () => 'https://example.com/avatar.png'
      ));
      
      expect(() => result.current.leaveCursor()).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    test('unsubscribes from channel on unmount', () => {
      const { unmount } = renderHook(() => usePresence(
        'board-123',
        mockUser,
        () => 'Test User',
        () => 'https://example.com/avatar.png'
      ));
      
      unmount();
      
      expect(mockChannel.unsubscribe).toHaveBeenCalled();
    });
  });

  describe('Board ID Changes', () => {
    test('creates new channel when board ID changes', () => {
      const { rerender } = renderHook(
        ({ boardId }) => usePresence(
          boardId,
          mockUser,
          () => 'Test User',
          () => 'https://example.com/avatar.png'
        ),
        { initialProps: { boardId: 'board-123' } }
      );
      
      expect(supabase.channel).toHaveBeenCalledTimes(1);
      
      // Change board ID
      rerender({ boardId: 'board-456' });
      
      // Should create new channel
      expect(supabase.channel).toHaveBeenCalledTimes(2);
    });
  });
});
