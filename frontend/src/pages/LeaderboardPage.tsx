import { useEffect, useState } from 'react';

import { fetchLeaderboard } from '../services/api';
import type { LeaderboardEntry } from '../types';

const MEDALS = ['🥇', '🥈', '🥉'];

export function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard()
      .then((response) => setEntries(response))
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
                    Loading leaderboard...
                  </td>
                </tr>
              ) : null}

              {!loading && entries.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-gray-400" colSpan={7}>
                    No ranked players yet.
                  </td>
                </tr>
              ) : null}

              {entries.map((entry, index) => (
                <tr key={entry.id} className="transition hover:bg-gray-800/70">
                  <td className="px-4 py-4 font-semibold text-white">
                    {MEDALS[index] ? `${MEDALS[index]} ${entry.position}` : entry.position}
                  </td>
                  <td className="px-4 py-4">{entry.username}</td>
                  <td className="px-4 py-4 text-green-400">{entry.rating}</td>
                  <td className="px-4 py-4">{entry.rank}</td>
                  <td className="px-4 py-4">{entry.wins}</td>
                  <td className="px-4 py-4">{entry.losses}</td>
                  <td className="px-4 py-4">{entry.gamesPlayed}</td>
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
