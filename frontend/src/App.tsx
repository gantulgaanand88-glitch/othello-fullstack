import { FormEvent, useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import axios from 'axios';

import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import GamePage from './pages/GamePage';
import LeaderboardPage from './pages/LeaderboardPage';
import { loginUser, registerUser, loginAsGuest, setAuthToken } from './services/api';
import type { AuthUser } from './types';

const AUTH_STORAGE_KEY = 'othello-auth';

type AuthMode = 'login' | 'register';

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // Expired if less than 60 seconds remaining
    return payload.exp * 1000 < Date.now() + 60_000;
  } catch {
    return true;
  }
}

interface AuthModalState {
  isOpen: boolean;
  mode: AuthMode;
}

interface StoredAuth {
  token: string;
  user: AuthUser;
}

function AuthModal({
  state,
  onClose,
  onSuccess,
}: {
  state: AuthModalState;
  onClose: () => void;
  onSuccess: (payload: StoredAuth) => void;
}) {
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
          <button type="button" onClick={onClose} className="text-gray-400 transition hover:text-white">
            Close
          </button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {state.mode === 'register' ? (
            <label className="block">
              <span className="mb-2 block text-sm text-gray-300">Username</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="w-full rounded-2xl border border-gray-700 bg-gray-900 px-4 py-3 text-white outline-none transition focus:border-green-500"
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
              className="w-full rounded-2xl border border-gray-700 bg-gray-900 px-4 py-3 text-white outline-none transition focus:border-green-500"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-gray-300">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-2xl border border-gray-700 bg-gray-900 px-4 py-3 text-white outline-none transition focus:border-green-500"
              required
            />
          </label>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Please wait...' : state.mode === 'login' ? 'Login' : 'Register'}
          </button>
        </form>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-full border border-gray-700 px-5 py-3 text-sm text-gray-300 transition hover:border-gray-500 hover:text-white"
        >
          Cancel
        </button>

        <div className="mt-4 flex items-center gap-3">
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
          Play as Guest
        </button>
      </div>
    </div>
  );
}

function App() {
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [modalState, setModalState] = useState<AuthModalState>({ isOpen: false, mode: 'login' });

  useEffect(() => {
    const stored = window.localStorage.getItem(AUTH_STORAGE_KEY);

    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored) as StoredAuth;

      if (isTokenExpired(parsed.token)) {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
        return;
      }

      setAuth(parsed);
      setAuthToken(parsed.token);
    } catch {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, []);

  const user = auth?.user ?? null;
  const token = auth?.token ?? null;

  const openLogin = (mode: AuthMode = 'login') => {
    setModalState({ isOpen: true, mode });
  };

  const handleAuthSuccess = (payload: StoredAuth) => {
    setAuth(payload);
    setAuthToken(payload.token);
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
    setModalState((current) => ({ ...current, isOpen: false }));
  };

  const handleLogout = () => {
    setAuth(null);
    setAuthToken(null);
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  const handleUserUpdate = (nextUser: AuthUser) => {
    if (!token) {
      return;
    }

    const nextAuth = { token, user: nextUser };
    setAuth(nextAuth);
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextAuth));
  };

  return (
    <div className="min-h-screen">
      <Navbar user={user} onLogin={() => openLogin('login')} onLogout={handleLogout} />

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Routes>
          <Route path="/" element={<LandingPage user={user} onOpenAuth={openLogin} />} />
          <Route
            path="/game"
            element={
              <GamePage
                user={user}
                token={token}
                onOpenAuth={openLogin}
                onUserUpdate={handleUserUpdate}
              />
            }
          />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
        </Routes>
      </main>

      <AuthModal
        state={modalState}
        onClose={() => setModalState((current) => ({ ...current, isOpen: false }))}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}

export default App;
