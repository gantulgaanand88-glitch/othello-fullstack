import { FormEvent, useEffect, useState } from 'react';
import axios from 'axios';

import { loginUser, registerUser, loginAsGuest, setAuthToken } from '../services/api';
import type { AuthUser } from '../types';

type AuthMode = 'login' | 'register';

interface AuthModalState {
  isOpen: boolean;
  mode: AuthMode;
}

interface StoredAuth {
  token: string;
  user: AuthUser;
}

interface AuthModalProps {
  state: AuthModalState;
  onClose: () => void;
  onSuccess: (payload: StoredAuth) => void;
}

export type { AuthMode, AuthModalState, StoredAuth };

export function AuthModal({ state, onClose, onSuccess }: AuthModalProps) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!state.isOpen) {
      setUsername('');
      setEmail('');
      setPassword('');
      setError(null);
      setLoading(false);
    }
  }, [state.isOpen, state.mode]);

  if (!state.isOpen) {
    return null;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response =
        state.mode === 'login'
          ? await loginUser({ email, password })
          : await registerUser({ username, email, password });

      onSuccess(response);
    } catch (submissionError) {
      if (axios.isAxiosError(submissionError)) {
        setError(submissionError.response?.data?.message ?? 'Unable to complete authentication.');
      } else {
        setError('Unable to complete authentication.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await loginAsGuest();
      onSuccess(response);
    } catch {
      setError('Unable to create guest session.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-gray-700 bg-gray-800 p-6 shadow-2xl animate-fade-in-up">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-green-400">Account</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              {state.mode === 'login' ? 'Welcome back' : 'Create your profile'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-700 hover:text-white"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {state.mode === 'register' ? (
            <label className="block">
              <span className="mb-2 block text-sm text-gray-300">Username</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="3–20 characters"
                className="w-full rounded-2xl border border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder-gray-600 outline-none transition focus:border-green-500 focus:ring-1 focus:ring-green-500/30"
                required
              />
            </label>
          ) : null}

          <label className="block">
            <span className="mb-2 block text-sm text-gray-300">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-2xl border border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder-gray-600 outline-none transition focus:border-green-500 focus:ring-1 focus:ring-green-500/30"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-gray-300">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 6 characters"
              className="w-full rounded-2xl border border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder-gray-600 outline-none transition focus:border-green-500 focus:ring-1 focus:ring-green-500/30"
              required
            />
          </label>

          {error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-500 hover:shadow-lg hover:shadow-green-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Please wait...' : state.mode === 'login' ? 'Login' : 'Register'}
          </button>
        </form>

        <div className="mt-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-700" />
          <span className="text-xs uppercase tracking-widest text-gray-500">or</span>
          <div className="h-px flex-1 bg-gray-700" />
        </div>

        <button
          type="button"
          onClick={handleGuestLogin}
          disabled={loading}
          className="mt-4 w-full rounded-full border border-gray-600 bg-gray-700/50 px-5 py-3 text-sm font-semibold text-gray-200 transition hover:bg-gray-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          ⚡ Play as Guest
        </button>

        <p className="mt-4 text-center text-xs text-gray-500">
          Guest games are unranked.{' '}
          <button
            type="button"
            onClick={() => {/* mode toggle handled by parent */}}
            className="text-green-400 transition hover:text-green-300"
          >
            {state.mode === 'login' ? 'Need an account?' : 'Already have one?'}
          </button>
        </p>
      </div>
    </div>
  );
}

export default AuthModal;
