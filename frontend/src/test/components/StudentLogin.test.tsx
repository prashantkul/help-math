import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../utils';
import StudentLogin from '../../pages/student/StudentLogin';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock useStudentAuth
const mockJoin = vi.fn();
vi.mock('../../hooks/useAuth', () => ({
  useStudentAuth: () => ({
    join: mockJoin,
    isLoading: false,
    student: null,
  }),
}));

describe('StudentLogin', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockJoin.mockClear();
  });

  describe('Step 1: Class Code Entry', () => {
    it('renders the class code input screen', () => {
      render(<StudentLogin />);

      expect(screen.getByText('Welcome!')).toBeInTheDocument();
      expect(screen.getByText('Enter your class code')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('ABC123')).toBeInTheDocument();
    });

    it('allows entering a class code', async () => {
      const { user } = render(<StudentLogin />);

      const input = screen.getByPlaceholderText('ABC123');
      await user.type(input, '96T2A2');

      expect(input).toHaveValue('96T2A2');
    });

    it('converts class code to uppercase', async () => {
      const { user } = render(<StudentLogin />);

      const input = screen.getByPlaceholderText('ABC123');
      await user.type(input, 'abc123');

      expect(input).toHaveValue('ABC123');
    });

    it('limits class code to 6 characters', async () => {
      const { user } = render(<StudentLogin />);

      const input = screen.getByPlaceholderText('ABC123');
      await user.type(input, 'ABC123EXTRA');

      expect(input).toHaveValue('ABC123');
    });

    it('shows error for invalid class code length', async () => {
      const { user } = render(<StudentLogin />);

      const input = screen.getByPlaceholderText('ABC123');
      await user.type(input, 'ABC');

      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toBeDisabled();
    });

    it('proceeds to passcode step with valid class code', async () => {
      const { user } = render(<StudentLogin />);

      await user.type(screen.getByPlaceholderText('ABC123'), '96T2A2');
      await user.click(screen.getByRole('button', { name: /next/i }));

      expect(screen.getByText('Your Passcode')).toBeInTheDocument();
    });

    it('navigates home when back button clicked on first step', async () => {
      const { user } = render(<StudentLogin />);

      await user.click(screen.getByRole('button', { name: /back/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  describe('Step 2: Passcode Entry', () => {
    async function goToPasscodeStep() {
      const { user } = render(<StudentLogin />);
      await user.type(screen.getByPlaceholderText('ABC123'), '96T2A2');
      await user.click(screen.getByRole('button', { name: /next/i }));
      return { user };
    }

    it('renders the passcode input screen', async () => {
      await goToPasscodeStep();

      expect(screen.getByText('Your Passcode')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('bear-1234')).toBeInTheDocument();
    });

    it('allows entering a passcode', async () => {
      const { user } = await goToPasscodeStep();

      const input = screen.getByPlaceholderText('bear-1234');
      await user.type(input, 'tiger-5678');

      expect(input).toHaveValue('tiger-5678');
    });

    it('converts passcode to lowercase', async () => {
      const { user } = await goToPasscodeStep();

      const input = screen.getByPlaceholderText('bear-1234');
      await user.type(input, 'BEAR-1234');

      expect(input).toHaveValue('bear-1234');
    });

    it('goes back to class code step when back clicked', async () => {
      const { user } = await goToPasscodeStep();

      await user.click(screen.getByRole('button', { name: /back/i }));

      expect(screen.getByText('Welcome!')).toBeInTheDocument();
    });

    it('shows error for invalid passcode', async () => {
      mockJoin.mockResolvedValue({ success: false, error: 'Invalid passcode' });
      const { user } = await goToPasscodeStep();

      await user.type(screen.getByPlaceholderText('bear-1234'), 'wrong-code');
      await user.click(screen.getByRole('button', { name: /join class/i }));

      await waitFor(() => {
        expect(screen.getByText(/invalid passcode/i)).toBeInTheDocument();
      });
    });

    it('proceeds to avatar step with valid credentials', async () => {
      mockJoin.mockResolvedValue({
        success: true,
        student: { id: '1', name: 'Test Student', avatar: 'bear' },
      });
      const { user } = await goToPasscodeStep();

      await user.type(screen.getByPlaceholderText('bear-1234'), '1111');
      await user.click(screen.getByRole('button', { name: /join class/i }));

      await waitFor(() => {
        expect(screen.getByText(/welcome/i)).toBeInTheDocument();
        expect(screen.getByText(/pick a friend/i)).toBeInTheDocument();
      });
    });
  });

  describe('Step 3: Avatar Selection', () => {
    async function goToAvatarStep() {
      mockJoin.mockResolvedValue({
        success: true,
        student: { id: '1', name: 'Test Student', avatar: 'bear' },
      });

      const { user } = render(<StudentLogin />);
      await user.type(screen.getByPlaceholderText('ABC123'), '96T2A2');
      await user.click(screen.getByRole('button', { name: /next/i }));
      await user.type(screen.getByPlaceholderText('bear-1234'), '1111');
      await user.click(screen.getByRole('button', { name: /join class/i }));

      await waitFor(() => {
        expect(screen.getByText(/pick a friend/i)).toBeInTheDocument();
      });

      return { user };
    }

    it('renders the avatar selection screen', async () => {
      await goToAvatarStep();

      expect(screen.getByText(/pick a friend/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /let's go/i })).toBeInTheDocument();
    });

    it('shows selected avatar name', async () => {
      await goToAvatarStep();

      expect(screen.getByText(/you picked/i)).toBeInTheDocument();
    });

    it('navigates to dashboard when completed', async () => {
      const { user } = await goToAvatarStep();

      await user.click(screen.getByRole('button', { name: /let's go/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/student/dashboard');
    });
  });
});
