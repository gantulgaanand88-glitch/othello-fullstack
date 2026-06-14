import { useEffect, useState } from 'react';
import { fetchLeaderboard } from '../services/api';
import type { LeaderboardEntry } from '../types';
import Skeleton from '../components/Skeleton';

const RANK_COLORS: Record<string, string> = {
  Beginner:     '#4b5563',
  Intermediate: '#4c7fc9',
  Advanced:     '#9b6bbf',
  Expert:       '#c87c3e',
  Master:       '#c9a84c',
};

export function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);
  const [search,  setSearch]  = useState('');

  useEffect(() => {
    fetchLeaderboard()
      .then(r => setEntries(r))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const filtered = entries.filter(e =>
    e.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto px-5">

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-5 pt-14 pb-7 border-b border-border">
        <div>
          <p className="font-mono text-2xs tracking-widest uppercase text-gold">Global Rankings</p>
          <h1 className="font-serif text-5xl text-ink mt-1">Top 100 Players</h1>
        </div>

        {/* Search */}
        <div className="relative">
          <input
            id="leaderboard-search"
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="search username"
            className="input w-60 pr-12"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-2xs text-ink-faint hover:text-ink transition-colors"
            >
              clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="py-4 pb-16">
        <table className="lb-table">
          <thead>
            <tr>
              <th className="w-14">#</th>
              <th>Player</th>
              <th>Badge</th>
              <th className="text-right">ELO</th>
              <th className="text-right">W</th>
              <th className="text-right">L</th>
              <th className="text-right">G</th>
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 12 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 7 }).map((_, j) => (
                  <td key={j}><div className="skeleton h-3 rounded-sm" style={{ width: j === 1 ? 120 : 40 }} /></td>
                ))}
              </tr>
            ))}

            {!loading && error && (
              <tr><td colSpan={7} className="text-danger font-mono text-sm py-8">
                Failed to load. Please refresh.
              </td></tr>
            )}

            {!loading && !error && filtered.length === 0 && (
              <tr><td colSpan={7} className="text-ink-faint font-mono text-sm py-8">
                {search ? 'No matching players.' : 'No ranked players yet.'}
              </td></tr>
            )}

            {!loading && !error && filtered.map(entry => (
              <tr key={entry.id}>
                {/* Rank */}
                <td className="nums">
                  <span className="font-mono text-ink-muted flex items-center gap-2">
                    {entry.position <= 3 && (
                      <span
                        className="inline-block w-0.5 h-4 rounded-sm"
                        style={{
                          background:
                            entry.position === 1 ? '#c9a84c' :
                            entry.position === 2 ? '#9ca3af' : '#8b6a3e',
                        }}
                      />
                    )}
                    {entry.position}
                  </span>
                </td>

                {/* Player */}
                <td className="font-medium text-ink">{entry.username}</td>

                {/* Badge */}
                <td>
                  <span
                    className="font-mono text-2xs uppercase tracking-wider"
                    style={{ color: RANK_COLORS[entry.rank] ?? '#4b5563' }}
                  >
                    {entry.rank}
                  </span>
                </td>

                {/* ELO */}
                <td className="text-right font-mono nums text-gold font-medium">{entry.rating}</td>

                {/* W / L / G */}
                <td className="text-right font-mono nums text-ink-muted text-sm">{entry.wins}</td>
                <td className="text-right font-mono nums text-ink-muted text-sm">{entry.losses}</td>
                <td className="text-right font-mono nums text-ink-faint text-sm">{entry.gamesPlayed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default LeaderboardPage;
