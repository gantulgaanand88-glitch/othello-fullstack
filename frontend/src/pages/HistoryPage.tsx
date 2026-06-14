import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchGameHistory } from '../services/api';
import { Skeleton } from '../components/Skeleton';

interface HistoryGame {
  gameId: string;
  opponent: string;
  result: 'win' | 'loss' | 'draw';
  ratingChange: number;
  date: string;
}

const RESULT_STYLES: Record<string, string> = {
  win: 'text-green-400',
  loss: 'text-red-400',
  draw: 'text-yellow-400',
};

const RESULT_LABELS: Record<string, string> = {
  win: 'W',
  loss: 'L',
  draw: 'D',
};

export function HistoryPage() {
  const { isAuthenticated } = useAuth();
  const [games, setGames] = useState<HistoryGame[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchHistory = useCallback(async (p: number) => {
    setLoading(true);
    setError(false);
    try {
      const response = await fetchGameHistory(p, 20);
      setGames(response.games);
      setTotalPages(response.totalPages);
      setPage(response.page);
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchHistory(1);
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, fetchHistory]);

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-2xl rounded-[2rem] border border-gray-800 bg-gray-800/80 p-10 text-center shadow-xl">
        <p className="text-sm uppercase tracking-[0.25em] text-green-400">Game History</p>
        <h1 className="mt-4 text-3xl font-semibold text-white">Sign in to view history</h1>
        <p className="mt-4 text-gray-300">
          Create an account or log in to see your past games.
        </p>
      </div>
    );
  }

  return (
    <section className="rounded-[2rem] border border-gray-800 bg-gray-800/80 p-6 shadow-xl sm:p-8 text-left">
      <div>
        <p className="text-sm uppercase tracking-[0.25em] text-green-400">History</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Game History</h1>
      </div>

      <div className="mt-8 overflow-hidden rounded-3xl border border-gray-700">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700 bg-gray-900/60 text-left text-sm text-gray-300">
            <thead className="bg-gray-800/80 text-xs uppercase tracking-[0.2em] text-gray-400">
              <tr>
                <th className="px-4 py-4" aria-label="Game number">#</th>
                <th className="px-4 py-4" aria-label="Opponent name">Opponent</th>
                <th className="px-4 py-4" aria-label="Game result">Result</th>
                <th className="px-4 py-4" aria-label="Rating change">Rating</th>
                <th className="px-4 py-4" aria-label="Date played">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-4"><Skeleton variant="text" width="2rem" /></td>
                    <td className="px-4 py-4"><Skeleton variant="text" width="8rem" /></td>
                    <td className="px-4 py-4"><Skeleton variant="text" width="2rem" /></td>
                    <td className="px-4 py-4"><Skeleton variant="text" width="3rem" /></td>
                    <td className="px-4 py-4"><Skeleton variant="text" width="6rem" /></td>
                  </tr>
                ))
              ) : null}

              {!loading && error ? (
                <tr>
                  <td className="px-4 py-6" colSpan={5}>
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                      Failed to load game history. Please try refreshing.
                    </div>
                  </td>
                </tr>
              ) : null}

              {!loading && !error && games.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-gray-400" colSpan={5}>
                    <div className="flex flex-col items-center gap-3 py-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-800 text-2xl">
                        🎮
                      </div>
                      <p className="text-sm">No games played yet. Start your first match!</p>
                    </div>
                  </td>
                </tr>
              ) : null}

              {games.map((game, index) => (
                <tr
                  key={game.gameId}
                  className="transition hover:bg-gray-800/70"
                >
                  <td className="px-4 py-4 text-gray-500">{(page - 1) * 20 + index + 1}</td>
                  <td className="px-4 py-4 font-medium text-white">{game.opponent}</td>
                  <td className="px-4 py-4">
                    <span className={`font-bold ${RESULT_STYLES[game.result] ?? 'text-gray-400'}`}>
                      {RESULT_LABELS[game.result] ?? game.result}
                    </span>
                  </td>
                  <td className="px-4 py-4 tabular-nums">
                    <span className={game.ratingChange >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {game.ratingChange >= 0 ? '+' : ''}{game.ratingChange}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-gray-500">
                    {new Date(game.date).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 ? (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => fetchHistory(page - 1)}
            disabled={page <= 1}
            className="rounded-full border border-gray-600 px-4 py-2 text-sm font-medium text-gray-200 transition hover:border-gray-500 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ← Previous
          </button>
          <span className="text-sm text-gray-400">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => fetchHistory(page + 1)}
            disabled={page >= totalPages}
            className="rounded-full border border-gray-600 px-4 py-2 text-sm font-medium text-gray-200 transition hover:border-gray-500 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next →
          </button>
        </div>
      ) : null}
    </section>
  );
}

export default HistoryPage;
