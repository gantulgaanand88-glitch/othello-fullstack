import { useEffect, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { createGuestSession, currentUser, type ArenaUser } from '../api/auth';
import { Brand } from './Brand';

const navigation = [
  ['Play', '/play'],
  ['Watch', '/watch'],
  ['Rankings', '/rankings'],
  ['Learn', '/learn'],
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<ArenaUser | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const realtimeEnabled = import.meta.env.VITE_ENABLE_REALTIME === 'true';

  useEffect(() => {
    if (!realtimeEnabled) return;
    currentUser().then(setUser).catch(() => setUser(null));
  }, [realtimeEnabled]);

  const signIn = async () => {
    if (!realtimeEnabled || user || authBusy) return;
    setAuthBusy(true);
    try {
      setUser(await createGuestSession());
    } catch {
      setUser(null);
    } finally {
      setAuthBusy(false);
    }
  };

  return (
    <div className="site-shell">
      <header className={`site-header${menuOpen ? ' menu-open' : ''}`}>
        <Brand />
        <nav className="main-nav" aria-label="Primary navigation">
          {navigation.map(([label, path]) => (
            <NavLink key={path} to={path} onClick={() => setMenuOpen(false)}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="header-actions">
          <span className="network-status"><i /> 2,418 online</span>
          <button className="button button-quiet" type="button" onClick={signIn} title={user ? `Signed in as ${user.handle}` : undefined}>
            {authBusy ? 'Joining…' : user?.handle ?? 'Sign in'}
          </button>
          <button
            className="menu-button"
            type="button"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span /><span />
          </button>
        </div>
      </header>
      <main>{children}</main>
      <footer className="site-footer">
        <Brand />
        <p>Built for the beautiful game of reversals.</p>
        <div>
          <a href="/status">Status</a>
          <a href="/privacy">Privacy</a>
          <a href="/fair-play">Fair play</a>
        </div>
      </footer>
    </div>
  );
}
