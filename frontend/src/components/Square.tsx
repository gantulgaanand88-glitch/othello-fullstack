import React, { useEffect, useState } from 'react';
import type { Cell } from '../types';

interface SquareProps {
  row: number;
  col: number;
  cell: Cell;
  isLegalMove: boolean;
  isLastMove: boolean;
  isFlipped: boolean;
  flipDelay: number;
  onClick: () => void;
}

export const Square = React.memo(function Square({
  row,
  col,
  cell,
  isLegalMove,
  isLastMove,
  isFlipped,
  flipDelay,
  onClick,
}: SquareProps) {
  const [animating, setAnimating] = useState(false);
  const [showOldColor, setShowOldColor] = useState(false);

  // When a piece first flips, briefly show the OLD color (the opposite),
  // then swap to the new color at the midpoint of the animation.
  useEffect(() => {
    if (!isFlipped || !cell) {
      setAnimating(false);
      setShowOldColor(false);
      return;
    }

    const startDelay = setTimeout(() => {
      setAnimating(true);
      setShowOldColor(true);

      const midSwap = setTimeout(() => {
        setShowOldColor(false);
      }, 300);

      const endTimer = setTimeout(() => {
        setAnimating(false);
      }, 620);

      return () => {
        clearTimeout(midSwap);
        clearTimeout(endTimer);
      };
    }, flipDelay);

    return () => clearTimeout(startDelay);
  }, [isFlipped, flipDelay, cell]);

  const colLetter = String.fromCharCode(97 + col).toUpperCase(); // A-H
  const rowNumber = 8 - row; // Othello standard: rows are numbered 1-8 starting from the bottom
  const label = `${colLetter}${rowNumber}: ${
    cell
      ? `${cell} piece`
      : isLegalMove
        ? 'empty, legal move available'
        : 'empty'
  }`;

  // Determine the displayed color: if animating and showing old color, invert
  let pieceColor = cell;
  if (animating && showOldColor && cell) {
    pieceColor = cell === 'black' ? 'white' : 'black';
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={[
        'relative aspect-square w-full overflow-hidden border border-black/20 transition-colors duration-200 outline-none focus:ring-2 focus:ring-inset focus:ring-green-400',
        'bg-[#2d5a27] hover:bg-[#35692e]',
        isLastMove ? 'ring-2 ring-inset ring-yellow-400/80' : '',
      ].join(' ')}
      style={{ perspective: '200px' }}
    >
      {isLegalMove && !cell ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="h-3 w-3 rounded-full bg-white/30 transition-transform duration-200 hover:scale-125" />
        </span>
      ) : null}

      {cell ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <span
            className={[
              'h-[72%] w-[72%] rounded-full transition-shadow duration-300',
              pieceColor === 'black'
                ? 'bg-gradient-to-br from-zinc-700 via-zinc-900 to-zinc-950 shadow-[0_2px_6px_rgba(0,0,0,0.6),inset_0_1px_2px_rgba(255,255,255,0.1)]'
                : 'bg-gradient-to-br from-white via-gray-50 to-gray-200 shadow-[0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.8)]',
              animating ? 'animate-piece-flip-3d' : '',
            ].join(' ')}
          />
        </span>
      ) : null}
    </button>
  );
});

export default Square;
