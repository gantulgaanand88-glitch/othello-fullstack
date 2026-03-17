import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';

import Navbar from './components/Navbar';
import { AuthModal } from './components/AuthModal';
import LandingPage from './pages/LandingPage';
import GamePage from './pages/GamePage';
import LeaderboardPage from './pages/LeaderboardPage';
import { setAuthToken } from './services/api';
import type { AuthUser } from './types';
import type { AuthMode, AuthModalState, StoredAuth } from './components/AuthModal';

const AUTH_STORAGE_KEY = 'othello-auth';

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // Expired if less than 60 seconds remaining
    return payload.exp * 1000 < Date.now() + 60_000;
  } catch {
    return true;
  }
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
