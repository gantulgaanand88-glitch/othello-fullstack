import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchUserProfile, fetchSelfProfile } from '../services/api';
import { Skeleton } from '../components/Skeleton';
import AccountSettings from '../components/AccountSettings';

import { RecentGame } from '../types';

interface ProfileData {
  id: string;
  username: string;
  email?: string;
  rating: number;
  rank: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  memberSince: string;
  lastLogin?: string | null;
  recentGames: RecentGame[];
}

const RESULT_STYLES: Record<string, string> = {
  win: 'text-green-400',
  loss: 'text-red-400',
  draw: 'text-yellow-400',
};

const RANK_BADGE_COLORS: Record<string, string> = {
  Beginner: 'border-gray-550 text-gray-400',
  Intermediate: 'border-blue-500 text-blue-400',
  Advanced: 'border-purple-500 text-purple-400',
  Expert: 'border-orange-500 text-orange-400',
  Master: 'border-yellow-500 text-yellow-300',
};

export function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'stats' | 'settings'>('stats');

  const isOwnProfile = currentUser?.username === username;

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    setError(null);
    setActiveTab('stats'); // Reset to stats on username switch

    const loadProfile = isOwnProfile ? fetchSelfProfile() : fetchUserProfile(username);

    loadProfile
      .then((data) => {
        setProfile(data as ProfileData);
      })
      .catch((err) => {
        if (err.response?.status === 404) {
          setError('Player not found.');
        } else {
          setError('Failed to load profile.');
        }
      })
      .finally(() => setLoading(false));
  }, [username, isOwnProfile]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-[2rem] border border-gray-800 bg-gray-800/80 p-8">
          <Skeleton variant="text" width="10rem" height="2rem" />
          <div className="mt-4"><Skeleton variant="text" width="6rem" /></div>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} variant="card" height="6rem" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="mx-auto max-w-2xl rounded-[2rem] border border-gray-800 bg-gray-800/80 p-10 text-center shadow-xl">
        <p className="text-sm uppercase tracking-[0.25em] text-red-400">Error</p>
        <h1 className="mt-4 text-3xl font-semibold text-white">{error ?? 'Profile not found'}</h1>
        <Link
          to="/"
          className="mt-6 inline-block text-sm font-medium text-green-400 transition hover:text-green-300"
        >
          ← Back to Home
        </Link>
      </div>
    );
  }

  const winRate = profile.gamesPlayed > 0
    ? ((profile.wins / profile.gamesPlayed) * 100).toFixed(1)
    : '0.0';

  const badgeColor = RANK_BADGE_COLORS[profile.rank] ?? 'border-gray-550 text-gray-400';

  return (
    <div className="space-y-6 text-left">
      {/* Profile Header */}
      <section className="rounded-[2rem] border border-gray-800 bg-gradient-to-br from-gray-800 via-gray-900 to-green-950/70 p-8 shadow-2xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-green-700 text-2xl font-bold text-white shadow-lg shadow-green-500/20 select-none">
              {profile.username[0]?.toUpperCase()}
            </span>
            <div>
              <h1 className="text-3xl font-bold text-white">{profile.username}</h1>
              <div className="mt-1 flex items-center gap-3">
                <span className={`rounded-full border px-3 py-0.5 text-xs font-medium ${badgeColor}`}>
                  {profile.rank}
                </span>
                <span className="text-sm text-gray-400">
                  Member since {new Date(profile.memberSince).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-sm text-gray-400">Rating</p>
            <p className="text-4xl font-bold tabular-nums text-green-400">{profile.rating}</p>
          </div>
        </div>
      </section>

      {/* Tabs Menu for own profile dashboard */}
      {isOwnProfile && (
        <div className="flex gap-6 border-b border-gray-800 pb-px">
          <button
            type="button"
            onClick={() => setActiveTab('stats')}
            className={`pb-3 text-sm font-semibold border-b-2 transition focus:outline-none ${
              activeTab === 'stats'
                ? 'border-green-500 text-green-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`pb-3 text-sm font-semibold border-b-2 transition focus:outline-none ${
              activeTab === 'settings'
                ? 'border-green-500 text-green-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Settings
          </button>
        </div>
      )}

      {activeTab === 'stats' ? (
        <>
          {/* Stats Grid */}
          <section className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {[
              { label: 'Games', value: profile.gamesPlayed, color: 'text-white' },
              { label: 'Wins', value: profile.wins, color: 'text-green-400' },
              { label: 'Losses', value: profile.losses, color: 'text-red-400' },
              { label: 'Draws', value: profile.draws, color: 'text-yellow-400' },
              { label: 'Win Rate', value: `${winRate}%`, color: 'text-white' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-gray-700 bg-gray-800/80 p-5 text-center transition hover:border-gray-600"
              >
                <p className="text-sm text-gray-400">{stat.label}</p>
                <p className={`mt-2 text-2xl font-semibold tabular-nums ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </section>

          {/* Recent Games */}
          <section className="rounded-[2rem] border border-gray-800 bg-gray-800/80 p-6 shadow-xl sm:p-8">
            <h2 className="text-xl font-semibold text-white">Recent Games</h2>
            <div className="mt-4 space-y-2">
              {profile.recentGames.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-500">No recent games.</p>
              ) : null}
              {profile.recentGames.map((game) => (
                <div
                  key={game.gameId}
                  className="flex items-center justify-between rounded-xl bg-gray-900/50 px-4 py-3 text-sm transition hover:bg-gray-900/70"
                >
                  <div className="flex items-center gap-3">
                    <span className={`font-bold ${RESULT_STYLES[game.result] ?? 'text-gray-400'}`}>
                      {game.result.toUpperCase()}
                    </span>
                    <span className="text-gray-300">vs {game.opponent}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`tabular-nums ${game.ratingChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {game.ratingChange >= 0 ? '+' : ''}{game.ratingChange}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(game.date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="rounded-[2rem] border border-gray-800 bg-gray-800/80 p-6 shadow-xl sm:p-8">
          <AccountSettings />
        </section>
      )}
    </div>
  );
}

export default ProfilePage;
