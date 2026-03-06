import type { AuthUser, Player } from '../types';
import { getPlayerRankLabel } from '../types';

interface PlayerPanelProps {
  user: Pick<AuthUser, 'username' | 'rating'> | { username: string; rating: number };
  color: Player;
  isActiveTurn: boolean;
  score: number;
  ratingChange?: number | null;
}

export function PlayerPanel({ user, color, isActiveTurn, score, ratingChange }: PlayerPanelProps) {
  return (
    <div
      className={[
        'rounded-3xl border bg-gray-800/90 p-5 shadow-xl transition-all duration-300',
        isActiveTurn ? 'border-green-500/40 shadow-green-500/5' : 'border-gray-700',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span
            className={[
              'inline-flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold uppercase',
              color === 'black'
                ? 'bg-gradient-to-br from-zinc-700 to-zinc-950 text-gray-200 shadow-[0_2px_8px_rgba(0,0,0,0.5)]'
                : 'bg-gradient-to-br from-white to-gray-200 text-gray-800 shadow-[0_2px_8px_rgba(0,0,0,0.2)]',
            ].join(' ')}
          >
            {color[0]}
          </span>
          <div>
            <p className="text-lg font-semibold text-white">{user.username}</p>
            <p className="text-sm text-gray-400">
              {user.rating} <span className="text-gray-600">&bull;</span> {getPlayerRankLabel(user.rating)}
            </p>
          </div>
        </div>

        {isActiveTurn ? (
          <span className="mt-1 flex items-center gap-1.5 rounded-full bg-green-500/15 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-green-400">
            <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse-soft" />
            Turn
          </span>
        ) : null}
      </div>

      <div className="mt-5 flex items-center justify-between rounded-2xl bg-gray-900/50 px-4 py-3">
        <span className="text-sm text-gray-400">Score</span>
        <span className="text-2xl font-bold tabular-nums text-white">{score}</span>
      </div>

      {ratingChange !== null && ratingChange !== undefined ? (
        <div className="mt-3 flex items-center justify-between rounded-2xl border border-gray-700/50 bg-gray-900/40 px-4 py-2.5 text-sm">
          <span className="text-gray-400">Rating</span>
          <span className={ratingChange >= 0 ? 'font-semibold text-green-400' : 'font-semibold text-red-400'}>
            {ratingChange >= 0 ? '+' : ''}
            {ratingChange}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export default PlayerPanel;
