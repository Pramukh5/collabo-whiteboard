import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock supabase
jest.mock('../../supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
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
  signIn: jest.fn().mockResolvedValue({ data: null, error: null }),
  signInWithGoogle: jest.fn().mockResolvedValue({ data: null, error: null }),
}));

// Mock AuthContext
jest.mock('../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => <div>{children}</div>,
  useAuth: () => ({
    user: null,
    profile: null,
    loading: false,
    signOut: jest.fn(),
  }),
}));

import Login from './Login';
import { signIn, signInWithGoogle } from '../../supabase';

const renderLogin = () => {
  return render(<Login />);
};

describe('Login Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders login form', async () => {
      renderLogin();
      
      await waitFor(() => {
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      });
    });

    test('renders sign in button', async () => {
      renderLogin();
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sign in|log in/i })).toBeInTheDocument();
      });
    });

    test('renders link to sign up page', async () => {
      renderLogin();
      
      await waitFor(() => {
        expect(screen.getByText(/sign up|create account|register/i)).toBeInTheDocument();
      });
    });

    test('renders Google sign in button', async () => {
      renderLogin();
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /google/i })).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation', () => {
    test('renders required email field', async () => {
      renderLogin();
      
      const emailInput = screen.getByLabelText(/email/i);
      expect(emailInput).toBeRequired();
    });

    test('renders required password field', async () => {
      renderLogin();
      
      const passwordInput = screen.getByLabelText(/password/i);
      expect(passwordInput).toBeRequired();
    });
  });

  describe('Form Submission', () => {
    test('calls signIn with email and password', async () => {
      signIn.mockResolvedValue({ data: { user: { id: '123' } }, error: null });
      
      renderLogin();
      
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      
      const submitButton = screen.getByRole('button', { name: /sign in|log in/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(signIn).toHaveBeenCalledWith('test@example.com', 'password123');
      });
    });

    test('shows error message on login failure', async () => {
      signIn.mockResolvedValue({ 
        data: null, 
        error: { message: 'Invalid login credentials' } 
      });
      
      renderLogin();
      
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
      
      const submitButton = screen.getByRole('button', { name: /sign in|log in/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/invalid|error|failed/i)).toBeInTheDocument();
      });
    });

    test('shows loading state during submission', async () => {
      // Make signIn hang to test loading state
      signIn.mockImplementation(() => new Promise(() => {}));
      
      renderLogin();
      
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      
      const submitButton = screen.getByRole('button', { name: /sign in|log in/i });
      fireEvent.click(submitButton);
      
      // Button should be disabled or show loading
      await waitFor(() => {
        const button = screen.getByRole('button', { name: /sign|loading/i });
        expect(button).toBeDisabled();
      });
    });
  });

  describe('Google Sign In', () => {
    test('calls signInWithGoogle when Google button clicked', async () => {
      signInWithGoogle.mockResolvedValue({ data: {}, error: null });
      
      renderLogin();
      
      const googleButton = screen.getByRole('button', { name: /google/i });
      fireEvent.click(googleButton);
      
      await waitFor(() => {
        expect(signInWithGoogle).toHaveBeenCalled();
      });
    });
  });
});
