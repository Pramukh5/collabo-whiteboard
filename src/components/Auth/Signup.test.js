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
  signUp: jest.fn().mockResolvedValue({ data: null, error: null }),
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

import Signup from './Signup';
import { signUp, signInWithGoogle } from '../../supabase';

const renderSignup = () => {
  return render(<Signup />);
};

describe('Signup Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders signup form', async () => {
      renderSignup();
      
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getAllByLabelText(/password/i)[0]).toBeInTheDocument();
    });

    test('renders display name field', async () => {
      renderSignup();
      
      expect(screen.getByLabelText(/name|display name/i)).toBeInTheDocument();
    });

    test('renders sign up button', async () => {
      renderSignup();
      
      expect(screen.getByRole('button', { name: /sign up|create account|register/i })).toBeInTheDocument();
    });

    test('renders link to login page', async () => {
      renderSignup();
      
      // Use getAllByText since there are multiple matches and check the first one
      const elements = screen.getAllByText(/sign in/i);
      expect(elements.length).toBeGreaterThan(0);
    });
  });

  describe('Form Validation', () => {
    test('requires all fields', async () => {
      renderSignup();
      
      // Check that fields have required attribute
      const nameInput = screen.getByLabelText(/name|display name/i);
      const emailInput = screen.getByLabelText(/email/i);
      
      expect(nameInput).toBeRequired();
      expect(emailInput).toBeRequired();
    });

    test('shows password mismatch error', async () => {
      renderSignup();
      
      const nameInput = screen.getByLabelText(/name|display name/i);
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInputs = screen.getAllByLabelText(/password/i);
      
      fireEvent.change(nameInput, { target: { value: 'Test User' } });
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInputs[0], { target: { value: 'password123' } });
      fireEvent.change(passwordInputs[1], { target: { value: 'differentpassword' } }); // Mismatch
      
      const submitButton = screen.getByRole('button', { name: /sign up|create account|register/i });
      fireEvent.click(submitButton);
      
      // Should show password mismatch error
      await waitFor(() => {
        expect(screen.getByText(/do not match|passwords/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    test('calls signUp with email, password, and display name', async () => {
      signUp.mockResolvedValue({ 
        data: { user: { id: '123' } }, 
        error: null 
      });
      
      renderSignup();
      
      const nameInput = screen.getByLabelText(/name|display name/i);
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInputs = screen.getAllByLabelText(/password/i);
      
      fireEvent.change(nameInput, { target: { value: 'Test User' } });
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInputs[0], { target: { value: 'password123' } });
      fireEvent.change(passwordInputs[1], { target: { value: 'password123' } }); // confirm password
      
      const submitButton = screen.getByRole('button', { name: /sign up|create account|register/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(signUp).toHaveBeenCalledWith(
          'test@example.com',
          'password123',
          'Test User'
        );
      });
    });

    test('shows error message on signup failure', async () => {
      signUp.mockResolvedValue({ 
        data: null, 
        error: { message: 'Email already registered' } 
      });
      
      renderSignup();
      
      const nameInput = screen.getByLabelText(/name|display name/i);
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInputs = screen.getAllByLabelText(/password/i);
      
      fireEvent.change(nameInput, { target: { value: 'Test User' } });
      fireEvent.change(emailInput, { target: { value: 'existing@example.com' } });
      fireEvent.change(passwordInputs[0], { target: { value: 'password123' } });
      fireEvent.change(passwordInputs[1], { target: { value: 'password123' } });
      
      const submitButton = screen.getByRole('button', { name: /sign up|create account|register/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/already|error|failed|registered/i)).toBeInTheDocument();
      });
    });

    test('shows success message after signup', async () => {
      signUp.mockResolvedValue({ 
        data: { user: { id: '123' } }, 
        error: null 
      });
      
      renderSignup();
      
      const nameInput = screen.getByLabelText(/name|display name/i);
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInputs = screen.getAllByLabelText(/password/i);
      
      fireEvent.change(nameInput, { target: { value: 'Test User' } });
      fireEvent.change(emailInput, { target: { value: 'new@example.com' } });
      fireEvent.change(passwordInputs[0], { target: { value: 'password123' } });
      fireEvent.change(passwordInputs[1], { target: { value: 'password123' } });
      
      const submitButton = screen.getByRole('button', { name: /sign up|create account|register/i });
      fireEvent.click(submitButton);
      
      // Should show success or confirmation message
      await waitFor(() => {
        expect(screen.getByText(/check your email|confirm|verification/i)).toBeInTheDocument();
      });
    });
  });

  describe('Google Sign Up', () => {
    test('calls signInWithGoogle when Google button clicked', async () => {
      signInWithGoogle.mockResolvedValue({ data: {}, error: null });
      
      renderSignup();
      
      const googleButton = screen.getByRole('button', { name: /google/i });
      fireEvent.click(googleButton);
      
      await waitFor(() => {
        expect(signInWithGoogle).toHaveBeenCalled();
      });
    });
  });
});
