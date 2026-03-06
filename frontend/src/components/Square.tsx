import type { Cell } from '../types';

interface SquareProps {
  cell: Cell;
  isLegalMove: boolean;
  isLastMove: boolean;
  isFlipped: boolean;
  onClick: () => void;
}

export function Square({ cell, isLegalMove, isLastMove, isFlipped, onClick }: SquareProps) {
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
        'relative aspect-square w-full overflow-hidden border border-black/20 bg-[#2d5a27] transition-colors duration-200 hover:bg-[#35692e]',
        isLastMove ? 'ring-2 ring-inset ring-yellow-400' : '',
      ].join(' ')}
    >
      {isLegalMove && !cell ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="h-3 w-3 rounded-full bg-white/35" />
        </span>
      ) : null}

      {cell ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <span
            className={[
              'h-[72%] w-[72%] rounded-full shadow-lg transition-transform duration-300',
              cell === 'black' ? 'bg-zinc-950' : 'bg-gray-100',
              isFlipped ? 'animate-piece-flip' : '',
            ].join(' ')}
          />
        </span>
      ) : null}
    </button>
  );
}

export default Square;
