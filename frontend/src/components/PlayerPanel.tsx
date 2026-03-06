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
    <div className="rounded-3xl border border-gray-700 bg-gray-800/90 p-5 shadow-xl">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span
            className={[
              'inline-flex h-12 w-12 items-center justify-center rounded-full border text-sm font-semibold uppercase',
              color === 'black'
                ? 'border-gray-600 bg-zinc-950 text-gray-200'
                : 'border-gray-300 bg-gray-100 text-gray-900',
            ].join(' ')}
          >
            {color[0]}
          </span>
          <div>
            <p className="text-lg font-semibold text-white">{user.username}</p>
            <p className="text-sm text-gray-400">
              {user.rating} • {getPlayerRankLabel(user.rating)}
            </p>
          </div>
        </div>

        {isActiveTurn ? <span className="h-3 w-3 rounded-full bg-green-400 animate-pulse-soft" /> : null}
      </div>

      <div className="mt-5 flex items-center justify-between text-sm text-gray-300">
        <span>Live Score</span>
        <span className="text-xl font-semibold text-white">{score}</span>
      </div>

      {ratingChange !== null && ratingChange !== undefined ? (
        <div className="mt-4 rounded-2xl border border-gray-700 bg-gray-900/70 px-4 py-3 text-sm text-gray-300">
          Rating change:
          <span className={ratingChange >= 0 ? 'ml-2 text-green-400' : 'ml-2 text-red-400'}>
            {ratingChange >= 0 ? '+' : ''}
            {ratingChange}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export default PlayerPanel;
