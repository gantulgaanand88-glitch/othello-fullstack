import { useEffect, useState } from 'react';
import { fetchLeaderboard } from '../services/api';
import type { LeaderboardEntry } from '../types';
import Skeleton from '../components/Skeleton';

const MEDALS = ['🥇', '🥈', '🥉'];

const RANK_COLORS: Record<string, string> = {
  Beginner: 'text-gray-400',
  Intermediate: 'text-blue-400',
  Advanced: 'text-purple-400',
  Expert: 'text-orange-400',
  Master: 'text-yellow-300',
};

export function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchLeaderboard()
      .then((response) => setEntries(response))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const filteredEntries = entries.filter((entry) =>
    entry.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section className="rounded-[2rem] border border-gray-800 bg-gray-800/80 p-6 shadow-xl sm:p-8 text-left">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-green-400">Leaderboard</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Top 100 players</h1>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search username..."
              className="w-full sm:w-64 rounded-full border border-gray-700 bg-gray-900 px-4 py-2 text-xs text-white placeholder-gray-500 outline-none transition focus:border-green-500 focus:ring-1 focus:ring-green-500/30"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-2.5 text-xs text-gray-500 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 select-none hidden md:block">Sorted by rating, then wins.</p>
        </div>
      </div>

      <div className="mt-8 overflow-hidden rounded-3xl border border-gray-700">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700 bg-gray-900/60 text-left text-sm text-gray-300">
            <thead className="bg-gray-800/80 text-xs uppercase tracking-[0.2em] text-gray-400">
              <tr>
                <th className="px-4 py-4">Rank</th>
                <th className="px-4 py-4">Player</th>
                <th className="px-4 py-4">Rating</th>
                <th className="px-4 py-4">Badge</th>
                <th className="px-4 py-4" aria-label="Wins">W</th>
                <th className="px-4 py-4" aria-label="Losses">L</th>
                <th className="px-4 py-4" aria-label="Games Played">G</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading && (
                <>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-4 py-4"><Skeleton width={30} height={16} /></td>
                      <td className="px-4 py-4"><Skeleton width={120} height={16} /></td>
                      <td className="px-4 py-4"><Skeleton width={50} height={16} /></td>
                      <td className="px-4 py-4"><Skeleton width={80} height={16} /></td>
                      <td className="px-4 py-4"><Skeleton width={30} height={16} /></td>
                      <td className="px-4 py-4"><Skeleton width={30} height={16} /></td>
                      <td className="px-4 py-4"><Skeleton width={30} height={16} /></td>
                    </tr>
                  ))}
                </>
              )}

              {!loading && error && (
                <tr>
                  <td className="px-4 py-6" colSpan={7}>
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                      Failed to load leaderboard. Please try refreshing.
                    </div>
                  </td>
                </tr>
              )}

              {!loading && !error && filteredEntries.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-gray-400 text-center" colSpan={7}>
                    {search ? 'No matching players found.' : 'No ranked players yet. Be the first to climb!'}
                  </td>
                </tr>
              )}

              {!loading &&
                !error &&
                filteredEntries.map((entry, index) => (
                  <tr
                    key={entry.id}
                    className={[
                      'transition',
                      entry.position === 1
                        ? 'bg-yellow-500/5 hover:bg-yellow-500/10'
                        : 'hover:bg-gray-800/70',
                    ].join(' ')}
                  >
                    <td className="px-4 py-4 font-semibold text-white">
                      {MEDALS[entry.position - 1] ? `${MEDALS[entry.position - 1]} ${entry.position}` : entry.position}
                    </td>
                    <td className="px-4 py-4 font-medium">{entry.username}</td>
                    <td className="px-4 py-4 font-semibold tabular-nums text-green-400">{entry.rating}</td>
                    <td className={`px-4 py-4 font-medium ${RANK_COLORS[entry.rank] ?? 'text-gray-400'}`}>
                      {entry.rank}
                    </td>
                    <td className="px-4 py-4 tabular-nums">{entry.wins}</td>
                    <td className="px-4 py-4 tabular-nums">{entry.losses}</td>
                    <td className="px-4 py-4 tabular-nums">{entry.gamesPlayed}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default LeaderboardPage;
