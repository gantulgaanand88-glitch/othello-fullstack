import type { GameState } from '../types';

interface GameOverModalProps {
  isOpen: boolean;
  result: 'win' | 'loss' | 'draw' | null;
  finalState: GameState | null;
  ratingChange: number | null;
  onRematch: () => void;
  onHome: () => void;
}

const RESULT_CONFIG = {
  win: { heading: 'Victory!', accent: 'text-green-400', glow: 'shadow-green-500/10' },
  loss: { heading: 'Defeat', accent: 'text-red-400', glow: 'shadow-red-500/10' },
  draw: { heading: 'Draw', accent: 'text-yellow-400', glow: 'shadow-yellow-500/10' },
} as const;

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

  const config = RESULT_CONFIG[result];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
      <div className={`w-full max-w-md rounded-3xl border border-gray-700 bg-gray-800 p-8 shadow-2xl ${config.glow} animate-fade-in-up`}>
        <p className={`text-sm uppercase tracking-[0.25em] ${config.accent}`}>Game Over</p>
        <h2 className="mt-3 text-4xl font-bold text-white">{config.heading}</h2>

        <div className="mt-5 flex items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-zinc-700 to-zinc-950 text-xs font-bold text-gray-200">B</span>
            <span className="text-2xl font-bold tabular-nums text-white">{finalState.blackScore}</span>
          </div>
          <span className="text-gray-600">&mdash;</span>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-white to-gray-200 text-xs font-bold text-gray-800">W</span>
            <span className="text-2xl font-bold tabular-nums text-white">{finalState.whiteScore}</span>
          </div>
        </div>

        {ratingChange !== null ? (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-gray-900/60 px-4 py-2 text-sm">
            <span className="text-gray-400">Rating</span>
            <span className={ratingChange >= 0 ? 'font-semibold text-green-400' : 'font-semibold text-red-400'}>
              {ratingChange >= 0 ? '+' : ''}{ratingChange}
            </span>
          </div>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onRematch}
            className="flex-1 rounded-full bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-500 hover:shadow-lg hover:shadow-green-500/20"
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
