import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

import Navbar from './components/Navbar';
import AuthModal from './components/AuthModal';
import CookieConsent from './components/CookieConsent';
import { useAuth } from './context/AuthContext';

// Lazy loading pages for performance and modularity
const LandingPage = lazy(() => import('./pages/LandingPage'));
const GamePage = lazy(() => import('./pages/GamePage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const SpectatorPage = lazy(() => import('./pages/SpectatorPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

// A loading spinner for lazy-loaded route Suspense fallback
function LoadingFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="relative w-9 h-9">
        <div className="absolute inset-0 rounded-full border border-border" />
        <div className="absolute inset-0 rounded-full border border-transparent border-t-gold animate-spin-slow" />
      </div>
    </div>
  );
}

function App() {
  const {
    user,
    isAuthModalOpen,
    authModalMode,
    login,
    closeAuthModal,
    openAuthModal,
    logout
  } = useAuth();

  return (
    <div className="min-h-dvh bg-base text-ink flex flex-col">
      <Navbar />

      <main className="flex-grow">
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/game" element={<GamePage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/profile/:username" element={<ProfilePage />} />
            <Route path="/spectate" element={<SpectatorPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </main>

      {/* Cookie consent banner */}
      <CookieConsent />

      {/* Modal is mounted globally and managed via context */}
      <AuthModal
        state={{ isOpen: isAuthModalOpen, mode: authModalMode }}
        onClose={closeAuthModal}
        onSuccess={(payload) => login(payload)}
      />
    </div>
  );
}

export default App;
