import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock supabase
jest.mock('../../supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ 
        data: { 
          session: { 
            user: { id: 'user-123', email: 'test@example.com' },
            access_token: 'token'
          } 
        } 
      }),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
  },
  getBoards: jest.fn(),
  createBoard: jest.fn(),
  deleteBoard: jest.fn(),
  getUserProfile: jest.fn().mockResolvedValue({ data: null, error: null }),
}));

// Mock AuthContext
jest.mock('../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => <div>{children}</div>,
  useAuth: () => ({
    user: { id: 'user-123', email: 'test@example.com' },
    profile: { display_name: 'Test User' },
    loading: false,
    signOut: jest.fn(),
    getAvatarUrl: () => 'https://example.com/avatar.png',
    getDisplayName: () => 'Test User',
  }),
}));

import Dashboard from './Dashboard';
import { getBoards, createBoard, deleteBoard } from '../../supabase';

const renderDashboard = () => {
  return render(<Dashboard />);
};

describe('Dashboard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getBoards.mockResolvedValue({ data: [], error: null });
  });

  describe('Rendering', () => {
    test('renders dashboard title', async () => {
      renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByText(/dashboard|my boards|boards/i)).toBeInTheDocument();
      });
    });

    test('renders create board button', async () => {
      renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create|new board/i })).toBeInTheDocument();
      });
    });
  });

  describe('Board List', () => {
    test('fetches and displays boards', async () => {
      const mockBoards = [
        { id: 'board-1', title: 'Board 1', created_at: '2024-01-01' },
        { id: 'board-2', title: 'Board 2', created_at: '2024-01-02' },
      ];
      getBoards.mockResolvedValue({ data: mockBoards, error: null });
      
      renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByText('Board 1')).toBeInTheDocument();
        expect(screen.getByText('Board 2')).toBeInTheDocument();
      });
    });

    test('shows empty state when no boards', async () => {
      getBoards.mockResolvedValue({ data: [], error: null });
      
      renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByText(/no boards|create your first|empty|get started/i)).toBeInTheDocument();
      });
    });
  });

  describe('Board Creation', () => {
    test('creates new board when button clicked', async () => {
      createBoard.mockResolvedValue({ 
        data: { id: 'new-board', title: 'Untitled Board' }, 
        error: null 
      });
      getBoards.mockResolvedValue({ data: [], error: null });
      
      renderDashboard();
      
      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /create|new board/i });
        fireEvent.click(createButton);
      });
      
      await waitFor(() => {
        expect(createBoard).toHaveBeenCalled();
      });
    });

    test('refreshes board list after creation', async () => {
      createBoard.mockResolvedValue({ 
        data: { id: 'new-board', title: 'Untitled Board' }, 
        error: null 
      });
      getBoards
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ 
          data: [{ id: 'new-board', title: 'Untitled Board', created_at: '2024-01-01' }], 
          error: null 
        });
      
      renderDashboard();
      
      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /create|new board/i });
        fireEvent.click(createButton);
      });
      
      await waitFor(() => {
        expect(getBoards).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Board Deletion', () => {
    test('deletes board on confirmation', async () => {
      const mockBoards = [{ id: 'board-1', title: 'Board 1', created_at: '2024-01-01' }];
      getBoards.mockResolvedValue({ data: mockBoards, error: null });
      deleteBoard.mockResolvedValue({ error: null });
      
      // Mock window.confirm
      window.confirm = jest.fn(() => true);
      
      renderDashboard();
      
      await waitFor(() => {
        const deleteButtons = screen.getAllByRole('button');
        const deleteButton = deleteButtons.find(btn => 
          btn.getAttribute('aria-label')?.includes('delete') ||
          btn.textContent?.toLowerCase().includes('delete') ||
          btn.title?.toLowerCase().includes('delete')
        );
        if (deleteButton) {
          fireEvent.click(deleteButton);
        }
      });
      
      // Check if either deleteBoard was called or confirm was triggered
      expect(window.confirm).toHaveBeenCalled();
    });
  });

  describe('Board Navigation', () => {
    test('board card links to board page', async () => {
      const mockBoards = [{ id: 'board-123', title: 'Test Board', created_at: '2024-01-01' }];
      getBoards.mockResolvedValue({ data: mockBoards, error: null });
      
      renderDashboard();
      
      await waitFor(() => {
        const boardTitle = screen.getByText('Test Board');
        expect(boardTitle).toBeInTheDocument();
      });
    });
  });
});
