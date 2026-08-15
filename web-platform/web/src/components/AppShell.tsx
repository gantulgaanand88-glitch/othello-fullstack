import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import type { ArenaUser } from '../api/auth';
import { Brand } from './Brand';

const navigation = [
  ['Play', '/play'],
  ['Watch', '/watch'],
  ['Rankings', '/rankings'],
  ['Learn', '/learn'],
] as const;

interface AppShellProps {
  children: ReactNode;
  user: ArenaUser | null;
  authBusy: boolean;
  edgeHealthy: boolean | null;
  onGuestSession: () => void;
}

export function AppShell({ children, user, authBusy, edgeHealthy, onGuestSession }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const statusLabel = edgeHealthy === null ? 'Checking edge' : edgeHealthy ? 'Edge online' : 'Local mode';

  return (
    <div className="site-shell">
      <header className={`site-header${menuOpen ? ' menu-open' : ''}`}>
        <Brand />
        <nav className="main-nav" aria-label="Primary navigation">
          {navigation.map(([label, path]) => (
            <NavLink key={path} to={path} onClick={() => setMenuOpen(false)}>{label}</NavLink>
          ))}
        </nav>
        <div className="header-actions">
          <span className={`network-status${edgeHealthy === false ? ' offline' : ''}`}><i /> {statusLabel}</span>
          <button
            className="button button-quiet"
            type="button"
            onClick={onGuestSession}
            disabled={Boolean(user) || authBusy}
            title={user ? `Guest session: ${user.handle}` : 'Create a private guest session'}
          >
            {authBusy ? 'Joining…' : user?.handle ?? 'Play as guest'}
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
        <div><Brand /><span className="beta-badge">BETA</span></div>
        <p>Independent, privacy-first competitive Reversi.</p>
        <nav aria-label="Legal and service links">
          <a href="/api/health">Status</a>
          <NavLink to="/privacy">Privacy</NavLink>
          <NavLink to="/terms">Terms</NavLink>
          <NavLink to="/fair-play">Fair play</NavLink>
        </nav>
      </footer>
    </div>
  );
}
