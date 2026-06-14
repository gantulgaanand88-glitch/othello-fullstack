import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { setAuthToken, loginAsGuest as apiLoginAsGuest } from '../services/api';
import type { AuthUser } from '../types';

interface StoredAuth { token: string; user: AuthUser; }

type AuthMode = 'login' | 'register';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isAuthModalOpen: boolean;
  authModalMode: AuthMode;
  openAuthModal: (mode?: AuthMode) => void;
  closeAuthModal: () => void;
  login: (payload: StoredAuth) => void;
  logout: () => void;
  loginAsGuest: () => Promise<void>;
  updateUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_STORAGE_KEY = 'othello-auth';

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now() + 60_000;
  } catch { return true; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [modalState, setModalState] = useState<{ isOpen: boolean; mode: AuthMode }>({
    isOpen: false,
    mode: 'login',
  });

  useEffect(() => {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as StoredAuth;
      if (isTokenExpired(parsed.token)) { localStorage.removeItem(AUTH_STORAGE_KEY); return; }
      setAuth(parsed);
      setAuthToken(parsed.token);
    } catch { localStorage.removeItem(AUTH_STORAGE_KEY); }
  }, []);

  const login = useCallback((payload: StoredAuth) => {
    setAuth(payload);
    setAuthToken(payload.token);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
    setModalState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const logout = useCallback(() => {
    setAuth(null);
    setAuthToken(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }, []);

  const loginAsGuestFn = useCallback(async () => {
    const response = await apiLoginAsGuest();
    login(response);
  }, [login]);

  const updateUser = useCallback((nextUser: AuthUser) => {
    setAuth(prev => {
      if (!prev) return null;
      const next = { ...prev, user: nextUser };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const openAuthModal = useCallback((mode: AuthMode = 'login') => {
    setModalState({ isOpen: true, mode });
  }, []);

  const closeAuthModal = useCallback(() => {
    setModalState(prev => ({ ...prev, isOpen: false }));
  }, []);

  return (
    <AuthContext.Provider value={{
      user: auth?.user ?? null,
      token: auth?.token ?? null,
      isAuthenticated: !!auth,
      isAuthModalOpen: modalState.isOpen,
      authModalMode: modalState.mode,
      openAuthModal,
      closeAuthModal,
      login,
      logout,
      loginAsGuest: loginAsGuestFn,
      updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export default AuthProvider;
