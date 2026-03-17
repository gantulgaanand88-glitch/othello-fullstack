import { useEffect, useState } from 'react';

import { fetchLeaderboard } from '../services/api';
import type { LeaderboardEntry } from '../types';

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

  useEffect(() => {
    fetchLeaderboard()
      .then((response) => setEntries(response))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="rounded-[2rem] border border-gray-800 bg-gray-800/80 p-6 shadow-xl sm:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-green-400">Leaderboard</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Top 100 players</h1>
        </div>
        <p className="text-sm text-gray-400">Sorted by rating, then wins.</p>
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
                <th className="px-4 py-4">W</th>
                <th className="px-4 py-4">L</th>
                <th className="px-4 py-4">G</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-gray-400" colSpan={7}>
                    <div className="flex items-center gap-3">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-green-400 border-t-transparent" />
                      Loading leaderboard...
                    </div>
                  </td>
                </tr>
              ) : null}

              {!loading && error ? (
                <tr>
                  <td className="px-4 py-6" colSpan={7}>
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                      Failed to load leaderboard. Please try refreshing.
                    </div>
                  </td>
                </tr>
              ) : null}

              {!loading && !error && entries.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-gray-400" colSpan={7}>
                    No ranked players yet. Be the first to climb!
                  </td>
                </tr>
              ) : null}

              {entries.map((entry, index) => (
                <tr
                  key={entry.id}
                  className={[
                    'transition',
                    index === 0
                      ? 'bg-yellow-500/5 hover:bg-yellow-500/10'
                      : 'hover:bg-gray-800/70',
                  ].join(' ')}
                >
                  <td className="px-4 py-4 font-semibold text-white">
                    {MEDALS[index] ? `${MEDALS[index]} ${entry.position}` : entry.position}
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
