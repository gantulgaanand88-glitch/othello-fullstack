import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { fetchLeaderboard, loginAsGuest, setAuthToken } from '../services/api';
import type { AuthUser, LeaderboardEntry } from '../types';

interface LandingPageProps {
  user: AuthUser | null;
  onOpenAuth: (mode?: 'login' | 'register') => void;
}

const FEATURES = [
  {
    icon: '⚡',
    title: 'Instant Matchmaking',
    desc: 'Rating-based pairing that widens intelligently.',
  },
  {
    icon: '📊',
    title: 'ELO Ranking',
    desc: 'Every win and loss adjusts your competitive rating.',
  },
  {
    icon: '🎯',
    title: 'Move Analysis',
    desc: 'Full move history with board-coordinate notation.',
  },
  {
    icon: '🔒',
    title: 'Private Rooms',
    desc: 'Create a room code and play with friends.',
  },
];

export function LandingPage({ user, onOpenAuth }: LandingPageProps) {
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    fetchLeaderboard()
      .then((entries) => setLeaders(entries.slice(0, 5)))
      .catch(() => setLeaders([]));
  }, []);

  const handlePlayAsGuest = async () => {
    try {
      const response = await loginAsGuest();
      setAuthToken(response.token);
      window.localStorage.setItem(
        'othello-auth',
        JSON.stringify(response),
      );
      window.location.href = '/game';
    } catch {
      onOpenAuth('login');
    }
  };

  return (
    <div className="space-y-8">
      <section className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-[2rem] border border-gray-800 bg-gradient-to-br from-gray-800 via-gray-900 to-green-950/70 p-8 shadow-2xl lg:p-12">
          <p className="text-sm uppercase tracking-[0.35em] text-green-400">Competitive Othello</p>
          <h1 className="mt-4 max-w-2xl text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Live ranked Reversi with instant matchmaking, clean analysis, and tournament-level polish.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-gray-300">
            Challenge players online, climb the leaderboard, and review every move in a modern multiplayer arena built for serious play.
          </p>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <Link
              to="/game"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-green-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-green-500 hover:shadow-lg hover:shadow-green-500/20"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              Play Online
            </Link>
            {!user ? (
              <>
                <button
                  type="button"
                  onClick={() => onOpenAuth('register')}
                  className="inline-flex items-center justify-center rounded-full border border-gray-700 px-6 py-3 text-sm font-semibold text-gray-200 transition hover:border-green-500/50 hover:bg-green-500/10 hover:text-white"
                >
                  Create Account
                </button>
                <button
                  type="button"
                  onClick={handlePlayAsGuest}
                  className="inline-flex items-center justify-center rounded-full border border-gray-600 bg-gray-700/50 px-6 py-3 text-sm font-semibold text-gray-200 transition hover:bg-gray-700"
                >
                  ⚡ Play as Guest
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
                <p className="mt-1 text-sm text-gray-400">
                  {user.isGuest ? 'Guest Player' : (
                    <>Rank: <span className="text-green-400">{user.rank}</span> &bull; Rating: <span className="font-semibold text-white">{user.rating}</span></>
                  )}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-gray-700 bg-gray-900/70 p-4 transition hover:border-gray-600">
                  <p className="text-sm text-gray-400">Games</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-white">{user.gamesPlayed}</p>
                </div>
                <div className="rounded-2xl border border-gray-700 bg-gray-900/70 p-4 transition hover:border-gray-600">
                  <p className="text-sm text-gray-400">Wins</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-green-400">{user.wins}</p>
                </div>
                <div className="rounded-2xl border border-gray-700 bg-gray-900/70 p-4 transition hover:border-gray-600">
                  <p className="text-sm text-gray-400">Losses</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-red-400">{user.losses}</p>
                </div>
                <div className="rounded-2xl border border-gray-700 bg-gray-900/70 p-4 transition hover:border-gray-600">
                  <p className="text-sm text-gray-400">Draws</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-yellow-400">{user.draws}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-gray-700 bg-gray-900/50 p-6 text-center">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10 text-2xl">
                🏆
              </div>
              <p className="text-sm text-gray-300">
                Sign in to unlock ranked matchmaking, persistent ratings, and your match history.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Features grid */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="rounded-2xl border border-gray-800 bg-gray-800/60 p-6 shadow-lg transition hover:border-green-500/30 hover:bg-gray-800/80"
          >
            <span className="text-2xl">{feature.icon}</span>
            <h3 className="mt-3 font-semibold text-white">{feature.title}</h3>
            <p className="mt-2 text-sm text-gray-400">{feature.desc}</p>
          </div>
        ))}
      </section>

      <section className="rounded-[2rem] border border-gray-800 bg-gray-800/80 p-8 shadow-xl backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-green-400">Top Players</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Leaderboard Preview</h2>
          </div>
          <Link to="/leaderboard" className="text-sm font-medium text-green-400 transition hover:text-green-300">
            View full leaderboard →
          </Link>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {leaders.length === 0 ? (
            <p className="col-span-full py-4 text-center text-sm text-gray-500">
              No ranked players yet. Be the first!
            </p>
          ) : null}
          {leaders.map((leader, index) => (
            <div
              key={leader.id}
              className={[
                'rounded-3xl border bg-gray-900/70 p-5 transition hover:border-green-500/30',
                index === 0 ? 'border-yellow-500/30' : 'border-gray-700',
              ].join(' ')}
            >
              <p className="text-sm text-gray-500">
                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '#'}{leader.position}
              </p>
              <h3 className="mt-3 text-xl font-semibold text-white">{leader.username}</h3>
              <p className="mt-1 text-sm text-gray-400">{leader.rank}</p>
              <p className="mt-5 text-3xl font-semibold text-green-400">{leader.rating}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 text-center text-xs text-gray-600">
        <p>Othello Arena &bull; Built with React, Socket.io, MongoDB &bull; © {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}

export default LandingPage;
