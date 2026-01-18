import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card } from '../../components/common';
import apiClient from '../../api/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resetLink, setResetLink] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await apiClient.forgotPassword(email);

    setIsLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      // For demo purposes, we show the reset link (in production, it would be sent via email)
      if (result.data?.reset_link) {
        setResetLink(result.data.reset_link);
      }
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-cyan-600 to-blue-700 flex items-center justify-center p-4">
        <Card variant="warm" padding="lg" className="w-full max-w-md text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Check Your Email</h1>
          <p className="text-gray-600 mb-6">
            If an account exists with that email, we've sent password reset instructions.
          </p>

          {/* Demo-only: Show reset link directly */}
          {resetLink && (
            <div className="mb-6 p-4 bg-amber-100 rounded-lg">
              <p className="text-sm text-amber-800 mb-2">Demo Mode: Reset link below</p>
              <Link
                to={resetLink}
                className="text-indigo-600 hover:text-indigo-800 underline break-all"
              >
                {window.location.origin}{resetLink}
              </Link>
            </div>
          )}

          <Link to="/teacher/login" className="text-indigo-600 hover:text-indigo-800">
            Back to Login
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-cyan-600 to-blue-700 flex items-center justify-center p-4">
      <Card variant="warm" padding="lg" className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-800 mb-2 text-center">Forgot Password</h1>
        <p className="text-gray-600 text-center mb-6">
          Enter your email address and we'll send you a link to reset your password.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter your email"
              required
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isLoading}
            className="w-full"
          >
            Send Reset Link
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/teacher/login" className="text-indigo-600 hover:text-indigo-800">
            Back to Login
          </Link>
        </div>
      </Card>
    </div>
  );
}
