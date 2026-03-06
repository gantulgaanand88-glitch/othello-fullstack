import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { fetchLeaderboard } from '../services/api';
import type { AuthUser, LeaderboardEntry } from '../types';

interface LandingPageProps {
  user: AuthUser | null;
  onOpenAuth: (mode?: 'login' | 'register') => void;
}

export function LandingPage({ user, onOpenAuth }: LandingPageProps) {
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    fetchLeaderboard()
      .then((entries) => setLeaders(entries.slice(0, 5)))
      .catch(() => setLeaders([]));
  }, []);

  return (
    <div className="space-y-8">
      <section className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-[2rem] border border-gray-800 bg-gradient-to-br from-gray-800 via-gray-900 to-green-950/70 p-8 shadow-2xl lg:p-12">
          <p className="text-sm uppercase tracking-[0.35em] text-green-400">Competitive Othello</p>
          <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Live ranked Reversi with instant matchmaking, clean analysis, and tournament-level polish.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-gray-300">
            Challenge players online, climb the leaderboard, and review every move in a modern multiplayer arena built for serious play.
          </p>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <Link
              to="/game"
              className="inline-flex items-center justify-center rounded-full bg-green-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-green-500"
            >
              Play Online
            </Link>
            {!user ? (
              <>
                <button
                  type="button"
                  onClick={() => onOpenAuth('register')}
                  className="inline-flex items-center justify-center rounded-full border border-gray-700 px-6 py-3 text-sm font-semibold text-gray-200 transition hover:border-gray-500 hover:bg-gray-800"
                >
                  Create Account
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAuth('login')}
                  className="inline-flex items-center justify-center rounded-full border border-gray-600 bg-gray-700/50 px-6 py-3 text-sm font-semibold text-gray-200 transition hover:bg-gray-700"
                >
                  Play as Guest
                </button>
              </>
            ) : null}
          </div>
        </div>

        <div className="rounded-[2rem] border border-gray-800 bg-gray-800/80 p-8 shadow-xl backdrop-blur">
          <p className="text-sm uppercase tracking-[0.25em] text-green-400">Your Profile</p>
          {user ? (
            <div className="mt-5 space-y-5">
              <div>
                <h2 className="text-2xl font-semibold text-white">{user.username}</h2>
                <p className="mt-1 text-sm text-gray-400">Current rating: {user.rating}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-gray-700 bg-gray-900/70 p-4">
                  <p className="text-sm text-gray-400">Games</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{user.gamesPlayed}</p>
                </div>
                <div className="rounded-2xl border border-gray-700 bg-gray-900/70 p-4">
                  <p className="text-sm text-gray-400">Wins</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{user.wins}</p>
                </div>
                <div className="rounded-2xl border border-gray-700 bg-gray-900/70 p-4">
                  <p className="text-sm text-gray-400">Losses</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{user.losses}</p>
                </div>
                <div className="rounded-2xl border border-gray-700 bg-gray-900/70 p-4">
                  <p className="text-sm text-gray-400">Draws</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{user.draws}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-gray-700 bg-gray-900/50 p-6 text-sm text-gray-300">
              Sign in to unlock ranked matchmaking, persistent ratings, and your match history.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[2rem] border border-gray-800 bg-gray-800/80 p-8 shadow-xl backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-green-400">Top Players</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Leaderboard Preview</h2>
          </div>
          <Link to="/leaderboard" className="text-sm font-medium text-green-400 transition hover:text-green-300">
            View full leaderboard
          </Link>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {leaders.map((leader) => (
            <div key={leader.id} className="rounded-3xl border border-gray-700 bg-gray-900/70 p-5">
              <p className="text-sm text-gray-500">#{leader.position}</p>
              <h3 className="mt-3 text-xl font-semibold text-white">{leader.username}</h3>
              <p className="mt-1 text-sm text-gray-400">{leader.rank}</p>
              <p className="mt-5 text-3xl font-semibold text-green-400">{leader.rating}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default LandingPage;
