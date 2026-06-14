import { useState, useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `nav-link${isActive ? ' active' : ''}`;

export function Navbar() {
  const { user, openAuthModal, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  return (
    <header className="sticky top-0 z-40 bg-base/95 backdrop-blur border-b border-border">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 h-13">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          {/* Board icon */}
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="flex-shrink-0">
            <rect x="1" y="1" width="20" height="20" rx="2" fill="#0d1a0d" stroke="#1e2e1e" strokeWidth="1"/>
            <rect x="1" y="1" width="9.5" height="9.5" rx="0" fill="#0f1f0f"/>
            <rect x="11.5" y="11.5" width="9.5" height="9.5" rx="0" fill="#0f1f0f"/>
            <circle cx="6" cy="6" r="2.5" fill="#f0ece4"/>
            <circle cx="16" cy="6" r="2.5" fill="#0e0e0e" stroke="#2a2926" strokeWidth="0.5"/>
            <circle cx="6" cy="16" r="2.5" fill="#0e0e0e" stroke="#2a2926" strokeWidth="0.5"/>
            <circle cx="16" cy="16" r="2.5" fill="#f0ece4"/>
          </svg>
          <span className="font-serif text-base text-ink leading-none tracking-tight group-hover:text-gold transition-colors">
            Othello<span className="text-gold">.</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-7">
          {[
            { to: '/',           label: 'Home',       end: true },
            { to: '/game',       label: 'Play' },
            { to: '/leaderboard',label: 'Ranks' },
            { to: '/spectate',   label: 'Watch' },
            ...(user && !user.isGuest
              ? [{ to: '/history', label: 'History' }, { to: `/profile/${user.username}`, label: 'Profile' }]
              : []),
          ].map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end} className={navLinkClass}>{label}</NavLink>
          ))}
        </nav>

        {/* Auth controls */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                to={user.isGuest ? '#' : `/profile/${user.username}`}
                className="hidden sm:flex items-center gap-2 text-xs font-mono"
              >
                <span className="text-ink">{user.username}</span>
                {user.isGuest
                  ? <span className="text-ink-faint">guest</span>
                  : <span className="text-gold nums">{user.rating}</span>}
              </Link>
              <button type="button" onClick={logout} className="btn-ghost text-ink-faint">
                {user.isGuest ? 'Leave' : 'Sign out'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => openAuthModal('login')}
              className="btn-gold"
              style={{ padding: '0.45rem 1.1rem', fontSize: '0.68rem' }}
            >
              Sign In
            </button>
          )}

          {/* Mobile toggle */}
          <button
            type="button"
            aria-label="Toggle menu"
            onClick={() => setMobileOpen(v => !v)}
            className="md:hidden flex flex-col gap-1.5 justify-center w-8 h-8 p-1 focus-gold"
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="block h-px bg-ink-muted transition-all duration-200"
                style={{
                  opacity: mobileOpen && i === 1 ? 0 : 1,
                  transform:
                    mobileOpen && i === 0 ? 'rotate(45deg) translateY(7px)' :
                    mobileOpen && i === 2 ? 'rotate(-45deg) translateY(-7px)' : 'none',
                }}
              />
            ))}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-surface px-5 py-5 animate-slide-down">
          <nav className="flex flex-col gap-5">
            {[
              { to: '/',            label: 'Home',    end: true },
              { to: '/game',        label: 'Play' },
              { to: '/leaderboard', label: 'Ranks' },
              { to: '/spectate',    label: 'Watch' },
              ...(user && !user.isGuest
                ? [{ to: '/history', label: 'History' }, { to: `/profile/${user.username}`, label: 'Profile' }]
                : []),
            ].map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className={navLinkClass}>{label}</NavLink>
            ))}
            <div className="h-px bg-border" />
            <Link to="/privacy" className="font-mono text-2xs text-ink-faint uppercase tracking-wider">Privacy</Link>
            <Link to="/terms"   className="font-mono text-2xs text-ink-faint uppercase tracking-wider">Terms</Link>
          </nav>
        </div>
      )}
    </header>
  );
}

export default Navbar;
