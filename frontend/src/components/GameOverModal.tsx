import type { GameState } from '../types';

interface GameOverModalProps {
  isOpen: boolean;
  result: 'win' | 'loss' | 'draw' | null;
  finalState: GameState | null;
  ratingChange: number | null;
  onRematch: () => void;
  onHome: () => void;
}

export function GameOverModal({
  isOpen,
  result,
  finalState,
  ratingChange,
  onRematch,
  onHome,
}: GameOverModalProps) {
  if (!isOpen || !result || !finalState) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-gray-700 bg-gray-800 p-6 shadow-2xl animate-fade-in-up">
        <p className="text-sm uppercase tracking-[0.25em] text-green-400">Game Over</p>
        <h2 className="mt-3 text-3xl font-semibold text-white">
          {result === 'win' ? 'Victory' : result === 'loss' ? 'Defeat' : 'Draw'}
        </h2>
        <p className="mt-3 text-sm text-gray-300">
          Final score: Black {finalState.blackScore} • White {finalState.whiteScore}
        </p>
        {ratingChange !== null ? (
          <p className="mt-2 text-sm text-gray-300">
            Rating:
            <span className={ratingChange >= 0 ? 'ml-2 text-green-400' : 'ml-2 text-red-400'}>
              {ratingChange >= 0 ? '+' : ''}{ratingChange}
            </span>
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onRematch}
            className="flex-1 rounded-full bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-500"
          >
            Rematch
          </button>
          <button
            type="button"
            onClick={onHome}
            className="flex-1 rounded-full border border-gray-600 px-5 py-3 text-sm font-semibold text-gray-200 transition hover:border-gray-500 hover:bg-gray-700"
          >
            Home
          </button>
        </div>
      </div>
    </div>
  );
}

export default GameOverModal;
