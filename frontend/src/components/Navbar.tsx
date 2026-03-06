import { Link, NavLink } from 'react-router-dom';

import type { AuthUser } from '../types';

interface NavbarProps {
  user: AuthUser | null;
  onLogin: () => void;
  onLogout: () => void;
}

export function Navbar({ user, onLogin, onLogout }: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-gray-800 bg-gray-900/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-green-600 text-lg font-bold text-white">
            O
          </span>
          <div>
            <p className="text-lg font-semibold text-white">Othello Arena</p>
            <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Ranked Multiplayer</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <NavLink to="/" className="text-sm text-gray-300 transition hover:text-white">
            Home
          </NavLink>
          <NavLink to="/game" className="text-sm text-gray-300 transition hover:text-white">
            Play
          </NavLink>
          <NavLink to="/leaderboard" className="text-sm text-gray-300 transition hover:text-white">
            Leaderboard
          </NavLink>
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="hidden rounded-full border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-300 sm:block">
                {user.username}{user.isGuest ? ' (Guest)' : ` • ${user.rating}`}
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="rounded-full border border-gray-600 px-4 py-2 text-sm font-medium text-gray-200 transition hover:border-gray-500 hover:bg-gray-800"
              >
                {user.isGuest ? 'Leave' : 'Logout'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onLogin}
              className="rounded-full bg-green-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-green-500"
            >
              Login / Register
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export default Navbar;
