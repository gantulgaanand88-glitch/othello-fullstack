import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';

import type { AuthUser } from '../types';

interface NavbarProps {
  user: AuthUser | null;
  onLogin: () => void;
  onLogout: () => void;
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm transition ${isActive ? 'text-green-400 font-medium' : 'text-gray-300 hover:text-white'}`;

export function Navbar({ user, onLogin, onLogout }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-gray-800 bg-gray-900/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-green-700 text-lg font-bold text-white shadow-lg shadow-green-500/20">
            O
          </span>
          <div>
            <p className="text-lg font-semibold text-white">Othello Arena</p>
            <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Ranked Multiplayer</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <NavLink to="/" end className={navLinkClass}>
            Home
          </NavLink>
          <NavLink to="/game" className={navLinkClass}>
            Play
          </NavLink>
          <NavLink to="/leaderboard" className={navLinkClass}>
            Leaderboard
          </NavLink>
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="hidden rounded-full border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-300 sm:block">
                <span className="font-medium text-white">{user.username}</span>
                {user.isGuest ? (
                  <span className="ml-1 text-gray-500">(Guest)</span>
                ) : (
                  <span className="ml-1 text-green-400">• {user.rating}</span>
                )}
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="rounded-full border border-gray-600 px-4 py-2 text-sm font-medium text-gray-200 transition hover:border-red-400/50 hover:bg-red-500/10 hover:text-red-300"
              >
                {user.isGuest ? 'Leave' : 'Logout'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onLogin}
              className="rounded-full bg-green-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-green-500 hover:shadow-lg hover:shadow-green-500/20"
            >
              Login / Register
            </button>
          )}

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-700 text-gray-300 transition hover:bg-gray-800 hover:text-white md:hidden"
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile nav dropdown */}
      {mobileOpen ? (
        <div className="border-t border-gray-800 bg-gray-900/95 px-4 py-4 backdrop-blur animate-slide-down md:hidden">
          <nav className="flex flex-col gap-3">
            <NavLink
              to="/"
              end
              className={navLinkClass}
              onClick={() => setMobileOpen(false)}
            >
              Home
            </NavLink>
            <NavLink
              to="/game"
              className={navLinkClass}
              onClick={() => setMobileOpen(false)}
            >
              Play
            </NavLink>
            <NavLink
              to="/leaderboard"
              className={navLinkClass}
              onClick={() => setMobileOpen(false)}
            >
              Leaderboard
            </NavLink>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

export default Navbar;
