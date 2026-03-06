import type { Cell } from '../types';

interface SquareProps {
  cell: Cell;
  isLegalMove: boolean;
  isLastMove: boolean;
  isFlipped: boolean;
  isPlaced: boolean;
  flipDelay: number;
  onClick: () => void;
}

export function Square({ cell, isLegalMove, isLastMove, isFlipped, isPlaced, flipDelay, onClick }: SquareProps) {
  const label = cell
    ? `${cell} piece`
    : isLegalMove
      ? 'Legal move'
      : 'Empty square';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={[
        'board-square relative aspect-square w-full overflow-hidden border border-black/10',
        isLastMove ? 'ring-2 ring-inset ring-yellow-400/80' : '',
      ].join(' ')}
    >
      {/* Subtle grid texture */}
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.04] to-transparent" />

      {isLegalMove && !cell ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="h-3 w-3 rounded-full bg-white/30 shadow-[0_0_6px_rgba(255,255,255,0.15)] transition-transform duration-200 hover:scale-125" />
        </span>
      ) : null}

      {cell ? (
        <span
          className="absolute inset-0 flex items-center justify-center"
          style={{ perspective: '200px' }}
        >
          <span
            className={[
              'piece-disc h-[72%] w-[72%] rounded-full',
              cell === 'black' ? 'piece-black' : 'piece-white',
              isPlaced ? 'animate-piece-place' : '',
              isFlipped ? 'animate-piece-wave-flip' : '',
            ].join(' ')}
            style={isFlipped ? { animationDelay: `${flipDelay}ms` } : undefined}
          />
        </span>
      ) : null}
    </button>
  );
}

export default Square;
